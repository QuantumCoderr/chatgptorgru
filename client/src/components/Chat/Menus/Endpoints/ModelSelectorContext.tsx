import debounce from 'lodash/debounce';
import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { isAgentsEndpoint, isAssistantsEndpoint } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import type { Endpoint, SelectedValues } from '~/common';
import { useAgentsMapContext, useAssistantsMapContext, useChatContext } from '~/Providers';
import { useEndpoints, useSelectorEffects, useKeyDialog } from '~/hooks';
import useSelectMention from '~/hooks/Input/useSelectMention';
import { useGetEndpointsQuery, useGetUserSubscriptionQuery } from '~/data-provider';
import { filterItems } from './utils';

type ModelSelectorContextType = {
  // State
  searchValue: string;
  selectedValues: SelectedValues;
  endpointSearchValues: Record<string, string>;
  searchResults: (t.TModelSpec | Endpoint)[] | null;
  // LibreChat
  modelSpecs: t.TModelSpec[];
  mappedEndpoints: Endpoint[];
  agentsMap: t.TAgentsMap | undefined;
  assistantsMap: t.TAssistantsMap | undefined;
  endpointsConfig: t.TEndpointsConfig;
  // Subscription
  userSubscription: any;
  isLoadingSubscription: boolean;

  // Functions
  endpointRequiresUserKey: (endpoint: string) => boolean;
  setSelectedValues: React.Dispatch<React.SetStateAction<SelectedValues>>;
  setSearchValue: (value: string) => void;
  setEndpointSearchValue: (endpoint: string, value: string) => void;
  handleSelectSpec: (spec: t.TModelSpec) => void;
  handleSelectEndpoint: (endpoint: Endpoint) => void;
  handleSelectModel: (endpoint: Endpoint, model: string) => void;
  getFilteredModels: (endpoint: string, models: string[]) => string[];
} & ReturnType<typeof useKeyDialog>;

const ModelSelectorContext = createContext<ModelSelectorContextType | undefined>(undefined);

export function useModelSelectorContext() {
  const context = useContext(ModelSelectorContext);
  if (context === undefined) {
    throw new Error('useModelSelectorContext must be used within a ModelSelectorProvider');
  }
  return context;
}

interface ModelSelectorProviderProps {
  children: React.ReactNode;
  startupConfig: t.TStartupConfig | undefined;
}

// Функция для получения моделей в зависимости от подписки
function getModelsBySubscription(planKey: string, config: any): string[] {
  if (!config || !config.openAI) {
    return [];
  }

  const lowerPlanKey = planKey.toLowerCase();
  let modelsEnvVar = '';

  switch (lowerPlanKey) {
    case 'free':
      modelsEnvVar = config.openAI.modelsEnvFree || '';
      break;
    case 'mini':
      modelsEnvVar = config.openAI.modelsEnvMini || '';
      break;
    case 'standard':
      modelsEnvVar = config.openAI.modelsEnvStandard || '';
      break;
    case 'pro':
      modelsEnvVar = config.openAI.modelsEnvPro || '';
      break;
    default:
      modelsEnvVar = config.openAI.modelsEnvFree || '';
  }

  return modelsEnvVar.split(',').map(model => model.trim()).filter(Boolean);
}

export function ModelSelectorProvider({ children, startupConfig }: ModelSelectorProviderProps) {
  const agentsMap = useAgentsMapContext();
  const assistantsMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { conversation, newConversation } = useChatContext();

  // Получаем информацию о подписке пользователя
  const { data: userSubscriptionData, isLoading: isLoadingSubscription } = useGetUserSubscriptionQuery();

  // Получаем текущий план пользователя и доступные модели
  const currentPlanKey = userSubscriptionData?.subscription?.plan?.key?.toLowerCase() || 'free';
  const allowedModelsFromSubscription = userSubscriptionData?.subscription?.plan?.allowedModels || [];

  // Получаем все модели из стартовой конфигурации
  const allModelSpecs = useMemo(() => startupConfig?.modelSpecs?.list ?? [], [startupConfig]);
  
  // Определяем список разрешенных моделей
  const allowedModels = useMemo(() => {
    // Если есть модели из подписки, используем их
    if (allowedModelsFromSubscription && allowedModelsFromSubscription.length > 0) {
      console.log('Используем модели из подписки:', allowedModelsFromSubscription);
      return allowedModelsFromSubscription;
    }
    
    // Иначе берём из конфигурации
    const modelsFromConfig = getModelsBySubscription(currentPlanKey, endpointsConfig);
    console.log('Используем модели из конфигурации:', modelsFromConfig);
    return modelsFromConfig;
  }, [allowedModelsFromSubscription, currentPlanKey, endpointsConfig]);

  // Фильтруем модели в зависимости от подписки пользователя
  const modelSpecs = useMemo(() => {
    if (!allowedModels || allowedModels.length === 0) {
      return allModelSpecs;
    }
    
    return allModelSpecs.filter(spec => {
      // Если это не OpenAI, то разрешаем все модели
      if (spec.preset.endpoint !== 'openAI') {
        return true;
      }
      
      // Проверяем доступность модели по подписке для OpenAI
      if (spec.preset.model) {
        return allowedModels.includes(spec.preset.model);
      }
      
      return true;
    });
  }, [allModelSpecs, allowedModels]);
  
  const { mappedEndpoints, endpointRequiresUserKey } = useEndpoints({
    agentsMap,
    assistantsMap,
    startupConfig,
    endpointsConfig,
  });
  
  const { onSelectEndpoint, onSelectSpec } = useSelectMention({
    // presets,
    modelSpecs,
    assistantsMap,
    endpointsConfig,
    newConversation,
    returnHandlers: true,
  });

  // State
  const [selectedValues, setSelectedValues] = useState<SelectedValues>({
    endpoint: conversation?.endpoint || '',
    model: conversation?.model || '',
    modelSpec: conversation?.spec || '',
  });
  
  useSelectorEffects({
    agentsMap,
    conversation,
    assistantsMap,
    setSelectedValues,
  });

  const [searchValue, setSearchValueState] = useState('');
  const [endpointSearchValues, setEndpointSearchValues] = useState<Record<string, string>>({});

  const keyProps = useKeyDialog();
  
  // Функция для фильтрации моделей по эндпоинту и подписке
  const getFilteredModels = (endpoint: string, models: string[]): string[] => {
    if (endpoint !== 'openAI') {
      return models;
    }
    
    if (!allowedModels || allowedModels.length === 0) {
      return models;
    }
    
    return models.filter(model => allowedModels.includes(model));
  };

  // Мемоизированные результаты поиска
  const searchResults = useMemo(() => {
    if (!searchValue) {
      return null;
    }
    const allItems = [...modelSpecs, ...mappedEndpoints];
    return filterItems(allItems, searchValue, agentsMap, assistantsMap || {});
  }, [searchValue, modelSpecs, mappedEndpoints, agentsMap, assistantsMap]);

  // Functions
  const setDebouncedSearchValue = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValueState(value);
      }, 200),
    [],
  );
  
  const setEndpointSearchValue = (endpoint: string, value: string) => {
    setEndpointSearchValues((prev) => ({
      ...prev,
      [endpoint]: value,
    }));
  };

  const handleSelectSpec = (spec: t.TModelSpec) => {
    let model = spec.preset.model ?? null;
    onSelectSpec?.(spec);
    if (isAgentsEndpoint(spec.preset.endpoint)) {
      model = spec.preset.agent_id ?? '';
    } else if (isAssistantsEndpoint(spec.preset.endpoint)) {
      model = spec.preset.assistant_id ?? '';
    }
    setSelectedValues({
      endpoint: spec.preset.endpoint,
      model,
      modelSpec: spec.name,
    });
  };

  const handleSelectEndpoint = (endpoint: Endpoint) => {
    if (!endpoint.hasModels) {
      if (endpoint.value) {
        onSelectEndpoint?.(endpoint.value);
      }
      setSelectedValues({
        endpoint: endpoint.value,
        model: '',
        modelSpec: '',
      });
    }
  };

  const handleSelectModel = (endpoint: Endpoint, model: string) => {
    if (isAgentsEndpoint(endpoint.value)) {
      onSelectEndpoint?.(endpoint.value, {
        agent_id: model,
        model: agentsMap?.[model]?.model ?? '',
      });
    } else if (isAssistantsEndpoint(endpoint.value)) {
      onSelectEndpoint?.(endpoint.value, {
        assistant_id: model,
        model: assistantsMap?.[endpoint.value]?.[model]?.model ?? '',
      });
    } else if (endpoint.value) {
      onSelectEndpoint?.(endpoint.value, { model });
    }
    setSelectedValues({
      endpoint: endpoint.value,
      model,
      modelSpec: '',
    });
  };

  const value = {
    // State
    searchValue,
    searchResults,
    selectedValues,
    endpointSearchValues,
    // LibreChat
    agentsMap,
    modelSpecs,
    assistantsMap,
    mappedEndpoints,
    endpointsConfig,
    // Subscription
    userSubscription: userSubscriptionData,
    isLoadingSubscription,

    // Functions
    handleSelectSpec,
    handleSelectModel,
    setSelectedValues,
    handleSelectEndpoint,
    setEndpointSearchValue,
    endpointRequiresUserKey,
    getFilteredModels,
    setSearchValue: setDebouncedSearchValue,
    // Dialog
    ...keyProps,
  };

  return <ModelSelectorContext.Provider value={value}>{children}</ModelSelectorContext.Provider>;
}
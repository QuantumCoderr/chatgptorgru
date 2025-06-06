import React from 'react';

const SocialButton = ({ id, enabled, serverDomain, oauthPath, Icon, label }) => {
  if (!enabled) {
    return null;
  }

  // Увеличенный размер для иконки Яндекса
  const isYandex = id === 'yandex';

  return (
    <div className="mt-2 flex gap-x-2">
      <a
        aria-label={`${label}`}
        className="flex w-full items-center space-x-3 rounded-2xl border border-border-light bg-surface-primary px-5 py-3 text-text-primary transition-colors duration-200 hover:bg-surface-tertiary"
        href={`${serverDomain}/oauth/${oauthPath}`}
        data-testid={id}
      >
        <div className={isYandex ? 'w-6 h-6' : ''}>
          <Icon />
        </div>
        <p>{label}</p>
      </a>
    </div>
  );
};

export default SocialButton;

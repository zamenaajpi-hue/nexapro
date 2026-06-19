import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const PasswordField: React.FC<PasswordFieldProps> = ({ className = '', autoComplete, ...props }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`password-field ${className}`.trim()}>
      <input
        {...props}
        type={isVisible ? 'text' : 'password'}
        autoComplete={autoComplete}
        className="password-field-input"
      />
      <button
        type="button"
        className="password-field-toggle"
        onClick={() => setIsVisible((value) => !value)}
        aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
        title={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

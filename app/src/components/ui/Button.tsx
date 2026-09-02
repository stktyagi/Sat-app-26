// src/components/ui/Button.tsx
import React, { ReactNode } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'red' | 'custom' | 'Banner' | 'none';
  size?: 'small' | 'medium' | 'large' | 'custom';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  fullWidth?: boolean;
  className?: string;
  textClassName?: string;
  children?: ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  title,
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  className = '',
  textClassName = ''
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-[#FFBA00] active:bg-[#FFBA10]';
      case 'custom':
        return 'bg-[#352C06] border-2 border-[#FDCE04]';
      case 'secondary':
        return 'bg-gray-200 active:bg-gray-300';
      case 'danger':
        return 'bg-red-600 active:bg-red-700';
      case 'success':
        return 'bg-green-600 active:bg-green-700';
      case 'outline':
        return ' bg-transparent ';
      case 'red':
        return 'bg-[#951323] active:bg-red-700';
      case 'Banner':
        return 'bg-transparent';
      case 'none':
        return '';
      default:
        return 'bg-blue-600 active:bg-blue-700';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return 'px-3 py-2';
      case 'medium':
        return 'px-6 py-3';
      case 'large':
        return 'px-8 py-4';
      case 'custom':
        return '';
      default:
        return 'px-6 py-3';
    }
  };

  const getTextVariantStyles = () => {
    switch (variant) {
      case 'primary':

      case 'danger':
      case 'success':
        return 'text-white';  
      case 'secondary':
        return 'text-gray-800';
      case 'outline':
        return 'text-[#BA1415]';
      case 'custom':
        return 'text-[#FDCE04] ';
      case 'none':
        return '';
      default:
        return '';
    }
  };

  const getTextSizeStyles = () => {
    switch (size) {
      case 'small':
        return 'text-sm';
      case 'medium':
        return 'text-base';
      case 'large':
        return 'text-lg';
      default:
        return 'text-base';
    }
  };

  const buttonClassName = [
    'rounded-lg',
    'items-center',
    'justify-center',
    'flex-row',
    className,
    getVariantStyles(),
    getSizeStyles(),
    fullWidth ? 'w-full' : '',
    disabled || loading ? 'opacity-50' : ''
  ].filter(Boolean).join(' ');

  const textClassNameString = [
    'font-semibold',
    'text-center',
    getTextVariantStyles(),
    getTextSizeStyles(),
    textClassName
  ].join(' ');

  return (
    <TouchableOpacity
      className={buttonClassName}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading && (
        <ActivityIndicator 
          size="small" 
          color={variant === 'secondary' || variant === 'outline' ? '#374151' : '#ffffff'} 
          className="mr-2"
        />
      )}
      {icon && !loading && (
        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="mr-2 text-lg">{icon}</Text>
      )}
      {children ? (
        children
      ) : (
        <Text style={{ fontFamily: 'Outfit_500Medium' }} className={textClassNameString}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

export default Button;
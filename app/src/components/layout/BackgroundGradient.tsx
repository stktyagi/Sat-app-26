import React from 'react';
import { View, ViewProps } from 'react-native';

export const BackgroundGradient: React.FC<ViewProps> = ({ children, style, ...props }) => {
  return (
    <View
      style={[{ flex: 1, backgroundColor: '#DBE2ED' }, style]}
      {...props}
    >
      {children}
    </View>
  );
};

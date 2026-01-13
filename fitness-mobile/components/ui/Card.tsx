import React from 'react'
import { View, ViewProps, StyleSheet, Platform } from 'react-native'

interface CardProps extends ViewProps {
  children: React.ReactNode
  variant?: 'default' | 'outlined' | 'elevated'
}

export function Card({ children, variant = 'default', style, ...props }: CardProps) {
  const variantStyle = variant === 'outlined' 
    ? styles.outlined 
    : variant === 'elevated' 
    ? styles.elevated 
    : styles.default

  return (
    <View
      style={[styles.base, variantStyle, style]}
      {...props}
    >
      {children}
    </View>
  )
}

const defaultShadow = Platform.select({
  web: {
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
})

const elevatedShadow = Platform.select({
  web: {
    boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
})

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  default: {
    ...defaultShadow,
    borderWidth: 1,
    borderColor: '#282B34',
  },
  outlined: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  elevated: {
    ...elevatedShadow,
    borderWidth: 1,
    borderColor: '#282B34',
  },
})

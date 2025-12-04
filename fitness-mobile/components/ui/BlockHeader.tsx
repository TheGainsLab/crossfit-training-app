import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface BlockHeaderProps {
  title: string
  count?: number
}

export function BlockHeader({ title, count }: BlockHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>
        {title}
        {count !== undefined && ` (${count})`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: '#DAE2EA',
    borderBottomColor: '#FE5858',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
  },
})

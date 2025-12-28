import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { hasUnreadMessages } from '@/lib/api/chat'

interface SupportChatCardProps {
  userId: number
}

export function SupportChatCard({ userId }: SupportChatCardProps) {
  const router = useRouter()
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    async function checkUnread() {
      const unread = await hasUnreadMessages(userId)
      setHasUnread(unread)
    }

    checkUnread()

    // Check periodically for new messages
    const interval = setInterval(checkUnread, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [userId])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SUPPORT</Text>
      </View>
      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => router.push('/support-chat')}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FE5858" />
          {hasUnread && <View style={styles.unreadBadge} />}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.buttonTitle}>Contact Support</Text>
          <Text style={styles.buttonSubtitle}>
            {hasUnread ? 'You have a new message' : 'Chat with our team'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 12,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(254, 88, 88, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FE5858',
    borderWidth: 2,
    borderColor: '#1F2937',
  },
  textContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  buttonSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
})

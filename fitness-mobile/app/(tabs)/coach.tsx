// fitness-mobile/app/(tabs)/coach.tsx
// Coach chat tab - messaging with coach/admin

import { View, Text, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import MessageBubble from '@/components/coach/MessageBubble';
import MessageInput from '@/components/coach/MessageInput';
import { Ionicons } from '@expo/vector-icons';
import { setupNotificationListener, clearBadgeCount } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';

interface Message {
  id: string;
  sender_type: 'user' | 'admin';
  sender_id: number | null;
  content: string;
  created_at: string;
  is_auto_reply: boolean;
}

interface Conversation {
  id: string;
  user_id: number;
  status: string;
  created_at: string;
  last_message_at: string | null;
  unread_by_user: boolean;
}

export default function CoachTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages();

    // Clear badge count when user opens chat
    clearBadgeCount();

    // Setup notification listeners
    const cleanup = setupNotificationListener(
      (notification) => {
        // Notification received while app is open
        console.log('Notification received in coach tab:', notification);
        // Refresh messages to show new message
        fetchMessages();
      },
      (response) => {
        // Notification tapped
        const data = response.notification.request.content.data;
        if (data.type === 'coach_message') {
          // Already on coach tab, just refresh
          fetchMessages();
          clearBadgeCount();
        }
      }
    );

    // Check if app was opened via notification (killed state)
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response?.notification.request.content.data.type === 'coach_message') {
        fetchMessages();
        clearBadgeCount();
      }
    });

    // Setup real-time subscription for new messages
    const supabase = createClient();
    let subscription: any = null;

    const setupRealtimeSubscription = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Get user ID to filter messages
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', session.user.id)
          .single();

        if (!userData) return;

        // Get user's conversation ID
        const { data: convData } = await supabase
          .from('support_conversations')
          .select('id')
          .eq('user_id', userData.id)
          .single();

        if (!convData) return;

        // Subscribe to new messages in this conversation
        subscription = supabase
          .channel('coach-messages')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'support_messages',
              filter: `conversation_id=eq.${convData.id}`,
            },
            (payload) => {
              console.log('New message received:', payload);
              const newMessage = payload.new as Message;
              
              // Only add if it's not from the current user (avoid duplicates)
              if (newMessage.sender_type === 'admin') {
                setMessages(prev => {
                  // Check if message already exists
                  if (prev.some(m => m.id === newMessage.id)) {
                    return prev;
                  }
                  return [...prev, newMessage];
                });

                // Scroll to bottom when new message arrives
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);

                // Clear badge since user is viewing messages
                clearBadgeCount();
              }
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Error setting up real-time subscription:', error);
      }
    };

    setupRealtimeSubscription();

    // Cleanup subscriptions on unmount
    return () => {
      cleanup();
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const fetchMessages = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Get API URL from environment
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

      // Fetch conversation and messages
      const response = await fetch(`${apiUrl}/api/athlete/chat`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setConversation(data.conversation);
        setMessages(data.messages || []);
        setError(null);

        // Scroll to bottom after messages load
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      } else {
        setError(data.error || 'Failed to load messages');
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || sending) return;

    setSending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated');
        setSending(false);
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

      // Optimistically add message to UI
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        sender_type: 'user',
        sender_id: null,
        content: content.trim(),
        created_at: new Date().toISOString(),
        is_auto_reply: false,
      };
      setMessages(prev => [...prev, tempMessage]);

      // Scroll to bottom immediately
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Send message
      const response = await fetch(`${apiUrl}/api/athlete/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: content.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        // Replace temp message with real message
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempMessage.id),
          data.message,
        ]);
      } else {
        // Remove temp message on error
        setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      // Remove temp message
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Start a conversation</Text>
        <Text style={styles.emptySubtitle}>
          Send a message to your coach and they'll respond as soon as possible
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={[
          styles.messagesList,
          messages.length === 0 && styles.messagesListEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FE5858"
          />
        }
      />

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <MessageInput onSend={handleSendMessage} disabled={sending} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  messagesList: {
    paddingVertical: 12,
  },
  messagesListEmpty: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#FCA5A5',
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#DC2626',
  },
});


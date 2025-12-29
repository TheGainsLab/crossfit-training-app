// fitness-mobile/components/coach/MessageBubble.tsx
// Individual message component for coach chat

import { View, Text, StyleSheet } from 'react-native';

interface Message {
  id: string;
  sender_type: 'user' | 'admin';
  content: string;
  created_at: string;
  is_auto_reply?: boolean;
}

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isCoach = message.sender_type === 'admin';
  const isAutoReply = message.is_auto_reply || false;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, isCoach ? styles.coachContainer : styles.userContainer]}>
      <View
        style={[
          styles.bubble,
          isCoach
            ? isAutoReply
              ? styles.autoReplyBubble
              : styles.coachBubble
            : styles.userBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isCoach && !isAutoReply ? styles.coachText : styles.userText,
          ]}
        >
          {message.content}
        </Text>
        <Text
          style={[
            styles.timeText,
            isCoach && !isAutoReply ? styles.coachTimeText : styles.userTimeText,
          ]}
        >
          {formatTime(message.created_at)}
          {isAutoReply && ' • Auto-reply'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  coachContainer: {
    alignItems: 'flex-start',
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  coachBubble: {
    backgroundColor: '#FE5858', // Brand coral color
  },
  userBubble: {
    backgroundColor: '#E5E7EB', // Light gray
  },
  autoReplyBubble: {
    backgroundColor: '#F3F4F6', // Very light gray
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  coachText: {
    color: '#FFFFFF',
  },
  userText: {
    color: '#1F2937',
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  coachTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  userTimeText: {
    color: '#9CA3AF',
  },
});


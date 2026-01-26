import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PROGRAMS, ProgramType } from '@/lib/subscriptions';
import { createClient } from '@/lib/supabase/client';

export default function SubscriptionsScreen() {
  const router = useRouter();
  const supabase = createClient();

  const handleProgramPress = (programId: ProgramType) => {
    router.push(`/subscriptions/${programId}`);
  };

  const handleClose = async () => {
    // Sign out user and return to sign-in screen
    await supabase.auth.signOut();
    router.replace('/auth/signin');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore plans</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={28} color="#F6FBFE" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer}>
        <View style={styles.programsContainer}>
          {Object.values(PROGRAMS).map((program) => (
            <TouchableOpacity
              key={program.id}
              style={styles.programCard}
              onPress={() => handleProgramPress(program.id)}
            >
              <View style={styles.programHeader}>
                <View style={styles.programTitleContainer}>
                  <Text style={styles.programName}>{program.displayName}</Text>
                  <Text style={styles.programPrice}>
                    From {program.monthlyPrice}/mo
                  </Text>
                </View>
              </View>

              <Text style={styles.programDescription}>
                {program.shortDescription}
              </Text>

              <TouchableOpacity
                style={styles.moreDetailsButton}
                onPress={() => handleProgramPress(program.id)}
              >
                <Text style={styles.moreDetailsText}>Learn More</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            All plans include a 3-day free trial. Cancel anytime with no
            commitment.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FBFE',
  },
  header: {
    backgroundColor: '#282B34',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F6FBFE',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 60,
    padding: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  programsContainer: {
    padding: 16,
    gap: 16,
  },
  programCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  programCardFeatured: {
    borderColor: '#FE5858',
    borderWidth: 3,
  },
  featuredBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#FE5858',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featuredBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  programIcon: {
    fontSize: 48,
    marginRight: 16,
  },
  programTitleContainer: {
    flex: 1,
  },
  programName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 4,
  },
  programPrice: {
    fontSize: 16,
    color: '#6B7280',
  },
  programDescription: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 16,
    lineHeight: 24,
  },
  moreDetailsButton: {
    alignSelf: 'flex-start',
  },
  moreDetailsText: {
    fontSize: 16,
    color: '#FE5858',
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});


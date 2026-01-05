import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native'
import { MealTemplate } from '@/lib/api/mealTemplates'

interface MealManagerProps {
  mealTemplates: MealTemplate[]
  onEditTemplate: (template: MealTemplate) => void
  onDeleteTemplate: (templateId: number) => void
  onCreateNew: () => void
  onLogTemplate: (templateId: number) => void
}

const MEAL_TYPE_EMOJIS: Record<string, string> = {
  breakfast: '☀️',
  lunch: '🌮',
  dinner: '🍽️',
  pre_workout: '💪',
  post_workout: '🥤',
  snack: '🍎',
  other: '🍽️',
}

export default function MealManager({
  mealTemplates,
  onEditTemplate,
  onDeleteTemplate,
  onCreateNew,
  onLogTemplate,
}: MealManagerProps) {
  const handleDeletePress = (template: MealTemplate) => {
    if (!template.id) return

    Alert.alert(
      'Delete Meal',
      `Are you sure you want to delete "${template.template_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteTemplate(template.id!)
        }
      ]
    )
  }

  const renderMealCard = ({ item: template }: { item: MealTemplate }) => (
    <View style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <View style={styles.mealTitleRow}>
          <Text style={styles.mealEmoji}>
            {MEAL_TYPE_EMOJIS[template.meal_type || 'other'] || '🍽️'}
          </Text>
          <Text style={styles.mealName} numberOfLines={1}>
            {template.template_name}
          </Text>
        </View>
        <Text style={styles.mealType}>
          {template.meal_type ? template.meal_type.replace('_', ' ').toUpperCase() : 'OTHER'}
        </Text>
      </View>

      <View style={styles.nutritionSummary}>
        <View style={styles.nutritionItem}>
          <Text style={styles.nutritionValue}>{Math.round(template.total_calories)}</Text>
          <Text style={styles.nutritionLabel}>cal</Text>
        </View>
        <View style={styles.nutritionItem}>
          <Text style={styles.nutritionValue}>{Math.round(template.total_protein)}g</Text>
          <Text style={styles.nutritionLabel}>protein</Text>
        </View>
        <View style={styles.nutritionItem}>
          <Text style={styles.nutritionValue}>{Math.round(template.total_carbohydrate)}g</Text>
          <Text style={styles.nutritionLabel}>carbs</Text>
        </View>
        <View style={styles.nutritionItem}>
          <Text style={styles.nutritionValue}>{Math.round(template.total_fat)}g</Text>
          <Text style={styles.nutritionLabel}>fat</Text>
        </View>
      </View>

      <View style={styles.mealActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.logButton]}
          onPress={() => onLogTemplate(template.id!)}
        >
          <Text style={styles.logButtonText}>🍽️ Log This Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => onEditTemplate(template)}
        >
          <Text style={styles.editButtonText}>✏️ Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeletePress(template)}
        >
          <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Your Meals</Text>
        <TouchableOpacity style={styles.createButton} onPress={onCreateNew}>
          <Text style={styles.createButtonText}>➕ Create New Meal</Text>
        </TouchableOpacity>
      </View>

      {mealTemplates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={styles.emptyTitle}>No meals yet</Text>
          <Text style={styles.emptySubtitle}>
            Create your first meal to get started with quick logging
          </Text>
          <TouchableOpacity style={styles.createFirstButton} onPress={onCreateNew}>
            <Text style={styles.createFirstText}>Create Your First Meal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={mealTemplates}
          keyExtractor={(item) => item.id?.toString() || item.template_name}
          renderItem={renderMealCard}
          contentContainerStyle={styles.mealList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  createButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  createFirstButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mealList: {
    padding: 16,
  },
  mealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mealHeader: {
    marginBottom: 12,
  },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  mealName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  mealType: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nutritionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FE5858',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  mealActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  logButton: {
    backgroundColor: '#FE5858',
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  editButtonText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
  },
})
























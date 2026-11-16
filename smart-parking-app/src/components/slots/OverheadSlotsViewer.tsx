import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { SlotInfo } from '../../types/parking';
import { TopDownCar } from './TopDownCar';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../../config/theme';

interface OverheadSlotsViewerProps {
  slots: Array<Pick<SlotInfo, 'id' | 'label' | 'occupied'> & Partial<SlotInfo>>;
  selectedSlotId?: string | null;
  aiRecommendedSlotId?: string | null;
  onSelectSlot?: (slot: SlotInfo) => void;
  compact?: boolean;
}

export function OverheadSlotsViewer({
  slots,
  selectedSlotId,
  aiRecommendedSlotId,
  onSelectSlot,
  compact = false,
}: OverheadSlotsViewerProps) {
  // Fallback to the real 5 parking slots if data is not yet loaded
  const fallbackSlots: Array<Pick<SlotInfo, 'id' | 'label' | 'occupied'> & Partial<SlotInfo>> = [
    { id: 'slot1', label: 'A1', occupied: false, index: 0, isBest: true, isTop3: true, prediction: '', estMinutes: 0, timingLabel: '', coordinate: { latitude: 0, longitude: 0 } },
    { id: 'slot2', label: 'A2', occupied: true, index: 1, isBest: false, isTop3: false, prediction: '', estMinutes: 0, timingLabel: '', coordinate: { latitude: 0, longitude: 0 } },
    { id: 'slot3', label: 'A3', occupied: false, index: 2, isBest: false, isTop3: true, prediction: '', estMinutes: 0, timingLabel: '', coordinate: { latitude: 0, longitude: 0 } },
    { id: 'slot4', label: 'B1', occupied: true, index: 3, isBest: false, isTop3: false, prediction: '', estMinutes: 0, timingLabel: '', coordinate: { latitude: 0, longitude: 0 } },
    { id: 'slot5', label: 'B2', occupied: false, index: 4, isBest: false, isTop3: false, prediction: '', estMinutes: 0, timingLabel: '', coordinate: { latitude: 0, longitude: 0 } },
  ];

  const displaySlots: Array<Pick<SlotInfo, 'id' | 'label' | 'occupied'> & Partial<SlotInfo>> =
    slots && slots.length > 0 ? slots : fallbackSlots;

  // Split slots into Row A (A1, A2, A3) and Row B (B1, B2)
  const topRow = displaySlots.some((s) => s.label?.startsWith('A'))
    ? displaySlots.filter((s) => s.label?.startsWith('A'))
    : displaySlots.slice(0, Math.ceil(displaySlots.length / 2));

  const bottomRow = displaySlots.some((s) => s.label?.startsWith('B'))
    ? displaySlots.filter((s) => s.label?.startsWith('B'))
    : displaySlots.slice(Math.ceil(displaySlots.length / 2));

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isCompactMode = compact || windowHeight < 760 || windowWidth < 390;

  // Dynamically calculate bay dimensions based on available viewport width
  const availableContentWidth = Math.max(260, windowWidth - 88);
  const maxBayWidthByRow = Math.floor((availableContentWidth - 24) / 3);

  const bayWidth = isCompactMode
    ? Math.min(60, Math.max(48, maxBayWidthByRow))
    : Math.min(68, Math.max(54, maxBayWidthByRow));
  const bayHeight = Math.round(bayWidth * 1.25);
  const carWidth = Math.round(bayWidth * 0.52);
  const carHeight = Math.round(bayHeight * 0.65);

  const renderSlot = (slot: any, index: number, isTopRow: boolean) => {
    const isAIRecommended = slot.id === aiRecommendedSlotId || (!aiRecommendedSlotId && slot.isBest);
    const isSelected = selectedSlotId === slot.id;
    const isOccupied = slot.occupied;
    const slotNum = slot.label ? slot.label.replace(/^Slot\s*/i, '') : `S${index + 1}`;

    const isAISelected = isSelected && isAIRecommended;
    const isUserSelected = isSelected && !isAIRecommended;

    return (
      <TouchableOpacity
        key={slot.id}
        style={[
          s.bay,
          { width: bayWidth, height: bayHeight },
          isTopRow ? s.bayTop : s.bayBottom,
          isAISelected && s.bayAISelected,
          isUserSelected && s.baySelected,
          !isSelected && isAIRecommended && !isOccupied && s.bayAIRec,
          !isSelected && !isAIRecommended && !isOccupied && s.bayFree,
        ]}
        onPress={() => onSelectSlot?.(slot)}
        activeOpacity={0.75}
        disabled={!onSelectSlot}
      >
        {/* Slot Number & Status Tag */}
        <View style={[s.slotHeader, isTopRow ? s.slotHeaderTop : s.slotHeaderBottom]}>
          <Text
            style={[
              s.slotNumber,
              isAISelected && s.slotNumberAISelected,
              isUserSelected && s.slotNumberSelected,
            ]}
          >
            {slotNum}
          </Text>
          {isAISelected ? (
            <Text style={s.aiSelectedTag}>AI Selected</Text>
          ) : isUserSelected ? (
            <Text style={s.selectedTag}>Selected</Text>
          ) : isAIRecommended && !isOccupied ? (
            <Text style={s.aiRecTag}>AI Rec</Text>
          ) : isOccupied ? (
            <Text style={s.occupiedTag}>Occupied</Text>
          ) : (
            <Text style={s.freeTag}>Free</Text>
          )}
        </View>

        {/* 3D Parked Car OR Available Space */}
        <View style={s.carContainer}>
          {isOccupied && !isSelected ? (
            <TopDownCar
              color="#F8FAFC"
              width={carWidth}
              height={carHeight}
            />
          ) : isAISelected ? (
            <View style={[s.aiSelectedBadge, isCompactMode && s.aiSelectedBadgeCompact]}>
              <Text style={s.selectedBadgeNum}>{slotNum}</Text>
              <Text style={s.aiSelectedBadgeText}>AI SELECTED</Text>
            </View>
          ) : isUserSelected ? (
            <View style={[s.selectedBadge, isCompactMode && s.selectedBadgeCompact]}>
              <Text style={s.selectedBadgeNum}>{slotNum}</Text>
              <Text style={s.selectedBadgeText}>SELECTED</Text>
            </View>
          ) : isAIRecommended && !isOccupied ? (
            <View style={s.emptyBay}>
              <View style={s.emptyTireMarker} />
              <View style={s.aiRecPill}>
                <Text style={s.aiRecPillText}>AI REC</Text>
              </View>
              <View style={s.emptyTireMarker} />
            </View>
          ) : (
            <View style={s.emptyBay}>
              <View style={s.emptyTireMarker} />
              <View style={s.freeBadgePill}>
                <Text style={s.freeBadgeText}>FREE</Text>
              </View>
              <View style={s.emptyTireMarker} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.container, isCompactMode && s.containerCompact]}>
      {/* Status Indicators Legend Strip: Free • Occupied • Selected • AI Rec */}
      <View style={s.legendStrip}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={s.legendText}>Free</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={s.legendText}>Occupied</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: colors.accent.orange }]} />
          <Text style={s.legendText}>Selected</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#2563EB' }]} />
          <Text style={s.legendText}>AI Rec</Text>
        </View>
      </View>

      {/* Top row of bays */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowContainer}
      >
        <View style={s.baysRow}>
          {topRow.map((slot, i) => renderSlot(slot, i, true))}
        </View>
      </ScrollView>

      {/* Central Drive Lane Divider with Dashed Marker */}
      <View style={s.laneDivider}>
        <View style={s.dashedLine} />
      </View>

      {/* Bottom row of bays */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowContainer}
      >
        <View style={s.baysRow}>
          {bottomRow.map((slot, i) => renderSlot(slot, i + topRow.length, false))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#E8ECF2',
    borderRadius: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  containerCompact: {
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#DDE2EA',
  },
  legendStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowContainer: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1,
  },
  baysRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bay: {
    backgroundColor: '#D9DFE8',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C8CFDC',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  bayFree: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: '#DEE5EE',
  },
  bayTop: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  bayBottom: {
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  baySelected: {
    borderColor: colors.accent.orange,
    backgroundColor: 'rgba(255, 91, 0, 0.08)',
  },
  bayAISelected: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  bayAIRec: {
    borderColor: 'rgba(37, 99, 235, 0.45)',
    backgroundColor: 'rgba(37, 99, 235, 0.04)',
  },
  slotHeader: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 5,
  },
  slotHeaderTop: {
    top: 3,
  },
  slotHeaderBottom: {
    bottom: 3,
  },
  slotNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  slotNumberSelected: {
    color: colors.accent.orange,
    fontWeight: '900',
  },
  slotNumberAISelected: {
    color: '#2563EB',
    fontWeight: '900',
  },
  aiSelectedTag: {
    fontSize: 8,
    color: '#2563EB',
    fontWeight: '800',
    marginTop: -2,
    letterSpacing: -0.2,
  },
  aiRecTag: {
    fontSize: 8,
    color: '#2563EB',
    fontWeight: '800',
    marginTop: -2,
    letterSpacing: -0.2,
  },
  occupiedTag: {
    fontSize: 8,
    color: '#EF4444',
    fontWeight: '800',
    marginTop: -2,
    letterSpacing: -0.2,
  },
  freeTag: {
    fontSize: 8,
    color: '#10B981',
    fontWeight: '800',
    marginTop: -2,
    letterSpacing: -0.2,
  },
  selectedTag: {
    fontSize: 8,
    color: colors.accent.orange,
    fontWeight: '800',
    marginTop: -2,
    letterSpacing: -0.2,
  },
  carContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadge: {
    backgroundColor: colors.accent.orange,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  selectedBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 10,
  },
  selectedBadgeNum: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  aiSelectedBadge: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  aiSelectedBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 10,
  },
  aiSelectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  emptyBay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyTireMarker: {
    width: 14,
    height: 3,
    backgroundColor: '#94A3B8',
    borderRadius: 2,
  },
  aiRecPill: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(37, 99, 235, 0.45)',
  },
  aiRecPillText: {
    fontSize: 8,
    color: '#2563EB',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  freeBadgePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  freeBadgeText: {
    fontSize: 8,
    color: '#059669',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  laneDivider: {
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 3,
  },
  dashedLine: {
    width: '92%',
    height: 1.5,
    borderWidth: 1,
    borderColor: '#B0B8C8',
    borderStyle: 'dashed',
  },
});

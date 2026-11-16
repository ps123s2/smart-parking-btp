import React from 'react';
import { View, StyleSheet } from 'react-native';

interface TopDownCarProps {
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Premium 3D Top-Down Vehicle Model.
 * Features realistic multi-layer depth, ground contact shadows, 4 rubber tires,
 * curved metallic bodywork, tinted windshields with specular glass reflections,
 * xenon projector headlights, and ruby LED taillights.
 */
export function TopDownCar({
  color = '#FFFFFF',
  width = 38,
  height = 70,
}: TopDownCarProps) {
  const scale = width / 38;

  return (
    <View style={[s.wrapper, { width: width + 8 * scale, height: height + 6 * scale }]}>
      {/* 1. Deep 3D Ground Contact Shadow */}
      <View
        style={[
          s.groundShadow,
          {
            width: width + 2 * scale,
            height: height + 4 * scale,
            borderRadius: 12 * scale,
          },
        ]}
      />

      {/* 2. Four Rubber Tires in Wheel Wells */}
      {/* Front-left wheel */}
      <View
        style={[
          s.tire,
          {
            top: 10 * scale,
            left: 1 * scale,
            width: 5 * scale,
            height: 12 * scale,
          },
        ]}
      />
      {/* Front-right wheel */}
      <View
        style={[
          s.tire,
          {
            top: 10 * scale,
            right: 1 * scale,
            width: 5 * scale,
            height: 12 * scale,
          },
        ]}
      />
      {/* Rear-left wheel */}
      <View
        style={[
          s.tire,
          {
            bottom: 10 * scale,
            left: 1 * scale,
            width: 5 * scale,
            height: 12 * scale,
          },
        ]}
      />
      {/* Rear-right wheel */}
      <View
        style={[
          s.tire,
          {
            bottom: 10 * scale,
            right: 1 * scale,
            width: 5 * scale,
            height: 12 * scale,
          },
        ]}
      />

      {/* 3. Main 3D Metallic Car Chassis */}
      <View
        style={[
          s.chassis,
          {
            width,
            height,
            backgroundColor: color,
            borderRadius: 10 * scale,
          },
        ]}
      >
        {/* Aerodynamic Side Mirrors */}
        <View
          style={[
            s.mirror,
            s.mirrorLeft,
            {
              top: 18 * scale,
              left: -4 * scale,
              width: 4 * scale,
              height: 8 * scale,
              borderTopLeftRadius: 3 * scale,
              borderBottomLeftRadius: 3 * scale,
            },
          ]}
        />
        <View
          style={[
            s.mirror,
            s.mirrorRight,
            {
              top: 18 * scale,
              right: -4 * scale,
              width: 4 * scale,
              height: 8 * scale,
              borderTopRightRadius: 3 * scale,
              borderBottomRightRadius: 3 * scale,
            },
          ]}
        />

        {/* Hood Section with Creases & Projector Headlights */}
        <View style={[s.hoodSection, { height: 14 * scale }]}>
          {/* Headlights with Xenon Lens */}
          <View style={[s.headlightWrap, { width: 6 * scale, height: 4 * scale }]}>
            <View style={s.headlightXenon} />
          </View>

          {/* Hood Crease lines */}
          <View style={s.hoodCreases}>
            <View style={[s.hoodLine, { height: 8 * scale }]} />
            <View style={[s.hoodCenterBadge, { width: 3 * scale, height: 3 * scale }]} />
            <View style={[s.hoodLine, { height: 8 * scale }]} />
          </View>

          <View style={[s.headlightWrap, { width: 6 * scale, height: 4 * scale }]}>
            <View style={s.headlightXenon} />
          </View>
        </View>

        {/* Front Curved Windshield with Glass Specular Glint */}
        <View
          style={[
            s.windshield,
            {
              height: 11 * scale,
              marginHorizontal: 3 * scale,
              borderTopLeftRadius: 7 * scale,
              borderTopRightRadius: 7 * scale,
            },
          ]}
        >
          {/* Glass Specular Reflection Streak */}
          <View style={[s.glassReflection, { width: 2 * scale, height: 9 * scale, left: 6 * scale }]} />
          <View style={[s.glassReflection, { width: 1.2 * scale, height: 7 * scale, left: 10 * scale }]} />
        </View>

        {/* 3D Curved Roof with Panoramic Tinted Glass Sunroof */}
        <View
          style={[
            s.roofCabin,
            {
              height: 22 * scale,
              marginHorizontal: 2 * scale,
            },
          ]}
        >
          <View
            style={[
              s.panoramicRoof,
              {
                width: 20 * scale,
                height: 14 * scale,
                borderRadius: 4 * scale,
              },
            ]}
          >
            {/* Sunroof Glass Reflection */}
            <View style={[s.sunroofReflection, { width: 2.5 * scale, height: 10 * scale }]} />
          </View>
        </View>

        {/* Rear Windshield */}
        <View
          style={[
            s.windshield,
            s.windshieldRear,
            {
              height: 8 * scale,
              marginHorizontal: 3.5 * scale,
              borderBottomLeftRadius: 6 * scale,
              borderBottomRightRadius: 6 * scale,
            },
          ]}
        >
          <View style={[s.glassReflection, { width: 2 * scale, height: 6 * scale, left: 7 * scale }]} />
        </View>

        {/* Rear Bumper with Ruby LED Taillights */}
        <View style={[s.rearBumper, { height: 9 * scale }]}>
          <View style={[s.taillight, { width: 7 * scale, height: 3 * scale, borderBottomLeftRadius: 3 * scale }]} />
          <View style={[s.rearSpoilerLine, { width: 14 * scale, height: 1.5 * scale }]} />
          <View style={[s.taillight, { width: 7 * scale, height: 3 * scale, borderBottomRightRadius: 3 * scale }]} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  groundShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ translateY: 2 }],
  },
  tire: {
    position: 'absolute',
    backgroundColor: '#0F172A',
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: '#334155',
    zIndex: 1,
  },
  chassis: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 1.5,
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  mirror: {
    position: 'absolute',
    backgroundColor: '#F1F5F9',
    borderWidth: 0.8,
    borderColor: '#CBD5E1',
    zIndex: 3,
  },
  mirrorLeft: {
    borderRightWidth: 0,
  },
  mirrorRight: {
    borderLeftWidth: 0,
  },
  hoodSection: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 3,
  },
  headlightWrap: {
    backgroundColor: '#FEF08A',
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headlightXenon: {
    width: '60%',
    height: '60%',
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  hoodCreases: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 1,
  },
  hoodLine: {
    width: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  hoodCenterBadge: {
    backgroundColor: '#94A3B8',
    borderRadius: 1.5,
  },
  windshield: {
    width: '84%',
    backgroundColor: '#0F172A',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#1E293B',
  },
  windshieldRear: {
    borderWidth: 0.5,
    borderColor: '#1E293B',
  },
  glassReflection: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 1,
    transform: [{ rotate: '18deg' }],
    top: 1,
  },
  roofCabin: {
    width: '88%',
    backgroundColor: '#F8FAFC',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.8,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  panoramicRoof: {
    backgroundColor: '#1E293B',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#334155',
  },
  sunroofReflection: {
    position: 'absolute',
    left: 4,
    top: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 1,
    transform: [{ rotate: '18deg' }],
  },
  rearBumper: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 3,
  },
  taillight: {
    backgroundColor: '#DC2626',
    borderWidth: 0.5,
    borderColor: '#EF4444',
  },
  rearSpoilerLine: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 1,
    marginBottom: 2,
  },
});

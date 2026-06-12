import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../constants/colors';
import { HERO_SLIDES, ALL_SERVICES } from '../../constants/machines';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── TRUST SIGNALS ───────────────────────────────────────────
const TRUST_ITEMS = [
  { icon: 'build', label: 'Expert\nTechnicians' },
  { icon: 'timer', label: 'Fast\nResponse' },
  { icon: 'verified', label: 'Quality\nService' },
  { icon: 'trending-up', label: 'Maximum\nUptime' },
] as const;

// ─── HERO SLIDER ─────────────────────────────────────────────
function HeroSlider() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out + slide out
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -20, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        setCurrentIdx(prev => (prev + 1) % HERO_SLIDES.length);
        slideAnim.setValue(20);
        // Fade in + slide in
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const slide = HERO_SLIDES[currentIdx];

  const handleCTA = () => {
    if (slide.ctaTarget === 'automation') {
      router.push('/(tabs)/automation');
    } else if (slide.ctaTarget === 'new-product') {
      router.push('/(tabs)/machines');
    } else {
      if ('subTab' in slide && slide.subTab) {
        router.push(`/(tabs)/service?tab=${slide.subTab}`);
      } else {
        router.push('/(tabs)/service');
      }
    }
  };

  return (
    <View style={styles.heroContainer}>
      {/* Background gradient */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.bgDark]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Machine image */}
      <Animated.View style={[styles.heroImageContainer, { opacity: fadeAnim }]}>
        <Image source={slide.image} style={styles.heroImage} resizeMode="contain" />
      </Animated.View>

      {/* Text content */}
      <Animated.View
        style={[
          styles.heroTextContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Slide dots */}
        <View style={styles.dotContainer}>
          {HERO_SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIdx && styles.dotActive]}
            />
          ))}
        </View>

        <Text style={styles.heroTitle}>{slide.title}</Text>
        <Text style={styles.heroDesc}>{slide.desc}</Text>

        <TouchableOpacity
          style={styles.heroCTA}
          onPress={handleCTA}
          activeOpacity={0.85}
        >
          <Text style={styles.heroCTAText}>{slide.ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.textOnRed} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── SERVICES SECTION ────────────────────────────────────────
function ServicesSection() {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedService, setExpandedService] = useState<string | null>(null);

  return (
    <View style={styles.servicesSection}>
      <Text style={styles.sectionTitle}>OUR SERVICES</Text>

      {ALL_SERVICES.map((group) => (
        <View key={group.group} style={styles.serviceGroup}>
          <TouchableOpacity
            style={styles.serviceGroupHeader}
            onPress={() =>
              setExpandedGroup(expandedGroup === group.group ? null : group.group)
            }
            activeOpacity={0.8}
          >
            <Text style={styles.serviceGroupTitle}>{group.group}</Text>
            <Ionicons
              name={expandedGroup === group.group ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {expandedGroup === group.group &&
            group.services.map((svc) => (
              <TouchableOpacity
                key={svc.name}
                style={styles.serviceCard}
                onPress={() =>
                  setExpandedService(expandedService === svc.name ? null : svc.name)
                }
                activeOpacity={0.85}
              >
                <View style={styles.serviceCardHeader}>
                  <View style={styles.redDot} />
                  <Text style={styles.serviceCardTitle}>{svc.name}</Text>
                  <Ionicons
                    name={expandedService === svc.name ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={Colors.textMuted}
                  />
                </View>
                {expandedService === svc.name && (
                  <Text style={styles.serviceCardDesc}>{svc.desc}</Text>
                )}
              </TouchableOpacity>
            ))}
        </View>
      ))}
    </View>
  );
}

// ─── WHATSAPP FAB ────────────────────────────────────────────
function WhatsAppFAB() {
  const handlePress = () => {
    const msg = encodeURIComponent(
      'Hello Nexus Machinery, I need assistance with an industrial machine. Please contact me.'
    );
    Linking.openURL(`https://wa.me/919109190790?text=${msg}`);
  };

  return (
    <TouchableOpacity style={styles.fab} onPress={handlePress} activeOpacity={0.9}>
      <MaterialCommunityIcons name="whatsapp" size={28} color="#fff" />
    </TouchableOpacity>
  );
}

// ─── MAIN HOME SCREEN ────────────────────────────────────────
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>NEXUS MACHINERY</Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('tel:9109190790')}
          style={styles.headerPhone}
        >
          <Ionicons name="call" size={16} color={Colors.primary} />
          <Text style={styles.headerPhoneText}>9109190790</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Slider */}
        <HeroSlider />

        {/* Trust Signals */}
        <View style={styles.trustBar}>
          {TRUST_ITEMS.map((item) => (
            <View key={item.label} style={styles.trustItem}>
              <Ionicons name={item.icon as any} size={22} color={Colors.primary} />
              <Text style={styles.trustLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Action Cards */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>QUICK ENQUIRY</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => router.push('/(tabs)/service')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.primaryDark, Colors.primary]}
                style={styles.quickCardGradient}
              >
                <MaterialCommunityIcons name="wrench-cog" size={32} color="#fff" />
                <Text style={styles.quickCardTitle}>Machine Service</Text>
                <Text style={styles.quickCardSubtitle}>Breakdown, Part & Other</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => router.push('/(tabs)/machines')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1A1A2E', '#16213E']}
                style={styles.quickCardGradient}
              >
                <MaterialCommunityIcons name="robot-industrial" size={32} color={Colors.primary} />
                <Text style={styles.quickCardTitle}>Buy Machines</Text>
                <Text style={styles.quickCardSubtitle}>New & Pre-owned</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => router.push('/(tabs)/automation')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1A1A2E', '#16213E']}
                style={styles.quickCardGradient}
              >
                <MaterialCommunityIcons name="robot" size={32} color={Colors.primary} />
                <Text style={styles.quickCardTitle}>Automation</Text>
                <Text style={styles.quickCardSubtitle}>Pick & Place, Robotic, Gantry</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => router.push('/(tabs)/other')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1A1A2E', '#16213E']}
                style={styles.quickCardGradient}
              >
                <Ionicons name="chatbubble-ellipses" size={32} color={Colors.primary} />
                <Text style={styles.quickCardTitle}>General Enquiry</Text>
                <Text style={styles.quickCardSubtitle}>Any other question</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* About / Contact Strip */}
        <View style={styles.contactStrip}>
          <View style={styles.contactInfo}>
            <Ionicons name="location" size={18} color={Colors.primary} />
            <Text style={styles.contactText}>
              Balaji Complex, 4/10 Corner, Gondal Rd, Rajkot
            </Text>
          </View>
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => Linking.openURL('tel:9109190790')}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={16} color="#fff" />
            <Text style={styles.callButtonText}>Call Us Now</Text>
          </TouchableOpacity>
        </View>

        {/* Services Section */}
        <ServicesSection />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Nexus Machinery Solutions, Rajkot
          </Text>
          <Text style={styles.footerSub}>
            Expert CNC, VMC, HMC, VTL Machine Service & Sales
          </Text>
        </View>
      </ScrollView>

      {/* WhatsApp FAB */}
      <WhatsAppFAB />
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.bgDark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLogo: {
    fontFamily: 'Montserrat_900Black',
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: 1.5,
  },
  headerPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerPhoneText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: Colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  // ── Hero ──
  heroContainer: {
    height: 400,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImageContainer: {
    position: 'absolute',
    right: -20,
    top: 20,
    width: SCREEN_W * 0.55,
    height: 340,
    zIndex: 1,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroTextContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    zIndex: 2,
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 20,
  },
  heroTitle: {
    fontFamily: 'Montserrat_900Black',
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
    lineHeight: 28,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  heroCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  heroCTAText: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 13,
    color: Colors.textOnRed,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // ── Trust Bar ──
  trustBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  trustLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 9,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // ── Quick Actions ──
  quickActionsSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_900Black',
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: 2,
    marginBottom: 16,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickCard: {
    width: (SCREEN_W - 44) / 2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickCardGradient: {
    padding: 18,
    gap: 8,
    minHeight: 120,
    justifyContent: 'center',
  },
  quickCardTitle: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  quickCardSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  // ── Contact Strip ──
  contactStrip: {
    margin: 16,
    marginTop: 24,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  contactText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  callButtonText: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.5,
  },
  // ── Services ──
  servicesSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  serviceGroup: {
    marginBottom: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serviceGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  serviceGroupTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: Colors.textPrimary,
    flex: 1,
  },
  serviceCard: {
    padding: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  serviceCardTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: Colors.textPrimary,
    flex: 1,
  },
  serviceCardDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    paddingLeft: 14,
    paddingBottom: 8,
  },
  // ── Footer ──
  footer: {
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: Colors.textMuted,
  },
  footerSub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // ── WhatsApp FAB ──
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.whatsapp,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 100,
  },
});

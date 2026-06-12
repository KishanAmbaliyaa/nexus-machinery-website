import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import { AUTOMATION_TYPES } from '../../constants/machines';
import { sanitizeFormData, ValidationError } from '../../lib/sanitize';
import { submitAutomationEnquiry } from '../../lib/submitEnquiry';

const { width: SCREEN_W } = Dimensions.get('window');
const COOLDOWN_MS = 15 * 60 * 1000;
const lastSubmit: Record<string, number> = {};

function checkCooldown(key: string) {
  const last = lastSubmit[key];
  if (!last) return { blocked: false };
  const elapsed = Date.now() - last;
  if (elapsed < COOLDOWN_MS) return { blocked: true, minutesLeft: Math.ceil((COOLDOWN_MS - elapsed) / 60000) };
  return { blocked: false };
}

// ─── AUTOMATION TYPE ICONS ────────────────────────────────────
const AUTO_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  'pick-place': 'cursor-default-click',
  robotic: 'robot',
  gantry: 'arrow-expand',
  other: 'dots-horizontal',
};

export default function AutomationScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [automationType, setAutomationType] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const cd = checkCooldown('automation');
    if (cd.blocked) {
      Alert.alert('Please Wait', `You recently sent an enquiry. Please wait ${cd.minutesLeft} more minute(s).`);
      return;
    }
    try {
      const safeData = sanitizeFormData({ automationType, name, company, phone, email });
      setLoading(true);
      await submitAutomationEnquiry({
        automationType: safeData.automationType,
        name: safeData.name,
        company: safeData.company,
        phone: safeData.phone,
        email: safeData.email,
      });
      lastSubmit['automation'] = Date.now();
      setSuccess(true);
      setName(''); setCompany(''); setPhone(''); setEmail('');
    } catch (err) {
      if (err instanceof ValidationError) {
        Alert.alert('Invalid Input', err.message);
      } else {
        Alert.alert('Error', 'Could not send enquiry. Please call us at 9109190790.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setStep(1); setAutomationType('');
    setName(''); setCompany(''); setPhone(''); setEmail('');
    setSuccess(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <MaterialCommunityIcons name="robot" size={22} color={Colors.primary} />
        <Text style={styles.screenTitle}>Automation Enquiry</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {success ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
            <Text style={styles.successTitle}>Enquiry Sent!</Text>
            <Text style={styles.successDesc}>
              Our automation team will contact you to discuss your requirements.
            </Text>
            <TouchableOpacity style={styles.newBtn} onPress={resetAll}>
              <Text style={styles.newBtnText}>Send Another Enquiry</Text>
            </TouchableOpacity>
          </View>
        ) : step === 1 ? (
          <>
            <Text style={styles.sectionIntro}>
              What kind of automation solution are you looking for?
            </Text>
            <Text style={styles.stepTitle}>
              <Text style={styles.stepNum}>1</Text> Select Automation Type
            </Text>
            <View style={styles.typeGrid}>
              {AUTOMATION_TYPES.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.typeCard}
                  onPress={() => { setAutomationType(a.label); setStep(2); }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={AUTO_ICONS[a.id] ?? 'cog'}
                    size={36}
                    color={Colors.primary}
                  />
                  <Text style={styles.typeCardTitle}>{a.label}</Text>
                  <Text style={styles.typeCardDesc}>{a.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
              <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <View style={styles.selectedBadge}>
              <MaterialCommunityIcons
                name={AUTO_ICONS[AUTOMATION_TYPES.find(a => a.label === automationType)?.id ?? 'other'] ?? 'cog'}
                size={14}
                color={Colors.primary}
              />
              <Text style={styles.selectedBadgeText}>{automationType}</Text>
            </View>

            <Text style={styles.stepTitle}>
              <Text style={styles.stepNum}>2</Text> Your Details
            </Text>

            {/* Form fields */}
            {[
              { label: 'Full Name', req: true, ph: 'Your name', val: name, set: setName, kb: 'default' as const },
              { label: 'Company Name', req: true, ph: 'Your company', val: company, set: setCompany, kb: 'default' as const },
              { label: 'Contact Number', req: true, ph: '10-digit mobile number', val: phone, set: setPhone, kb: 'phone-pad' as const },
              { label: 'Email', req: false, ph: 'Your email', val: email, set: setEmail, kb: 'email-address' as const },
            ].map((f) => (
              <View key={f.label} style={styles.fieldContainer}>
                <Text style={styles.inputLabel}>
                  {f.label}{' '}
                  {f.req
                    ? <Text style={styles.required}>*</Text>
                    : <Text style={styles.optional}>(optional)</Text>}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={f.ph}
                  placeholderTextColor={Colors.textMuted}
                  value={f.val}
                  onChangeText={f.set}
                  keyboardType={f.kb}
                  autoCapitalize={f.kb === 'email-address' ? 'none' : 'words'}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Send Enquiry</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Info box */}
        {step === 1 && !success && (
          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="information" size={18} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              Nexus Machinery provides end-to-end automation solutions: design, installation,
              programming and integration to improve productivity and efficiency.
            </Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgDark },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  screenTitle: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 60 },
  sectionIntro: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  stepTitle: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  stepNum: {
    fontFamily: 'Montserrat_900Black',
    fontSize: 20,
    color: Colors.primary,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  typeCard: {
    width: (SCREEN_W - 44) / 2,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 140,
    justifyContent: 'center',
  },
  typeCardTitle: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 15,
    color: Colors.textPrimary,
  },
  typeCardDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  selectedBadgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldContainer: { marginBottom: 14 },
  inputLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  required: { color: Colors.primary },
  optional: { color: Colors.textMuted, fontFamily: 'Montserrat_400Regular', fontSize: 11 },
  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 10,
    marginTop: 8,
  },
  submitBtnText: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    marginTop: 20,
  },
  infoText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    flex: 1,
  },
  successBox: { alignItems: 'center', paddingVertical: 60, gap: 14 },
  successTitle: {
    fontFamily: 'Montserrat_900Black',
    fontSize: 24,
    color: Colors.success,
  },
  successDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  newBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  newBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: Colors.primary,
  },
});

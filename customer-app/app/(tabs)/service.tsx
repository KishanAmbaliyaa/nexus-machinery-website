import React, { useState, useRef, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import Colors from '../../constants/colors';
import { MACHINE_TYPES, SUPPORT_TYPES } from '../../constants/machines';
import { sanitizeFormData, ValidationError } from '../../lib/sanitize';
import {
  submitBreakdownEnquiry,
  submitPartEnquiry,
  submitOtherServiceEnquiry,
} from '../../lib/submitEnquiry';

const { width: SCREEN_W } = Dimensions.get('window');
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const lastSubmit: Record<string, number> = {};

function checkCooldown(key: string): { blocked: boolean; minutesLeft?: number } {
  const last = lastSubmit[key];
  if (!last) return { blocked: false };
  const elapsed = Date.now() - last;
  if (elapsed < COOLDOWN_MS) {
    return { blocked: true, minutesLeft: Math.ceil((COOLDOWN_MS - elapsed) / 60000) };
  }
  return { blocked: false };
}

// ─── PHOTO PICKER ─────────────────────────────────────────────
function PhotoPickerButton({
  photoUri,
  onPick,
  onClear,
}: {
  photoUri: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <View>
      <Text style={styles.inputLabel}>
        Photo <Text style={styles.optional}>(optional)</Text>
      </Text>
      {photoUri ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
            <Ionicons name="trash" size={14} color="#fff" />
            <Text style={styles.clearBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.mediaBtn} onPress={onPick} activeOpacity={0.8}>
          <Ionicons name="camera" size={20} color={Colors.primary} />
          <Text style={styles.mediaBtnText}>Take / Upload Photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── VOICE RECORDER ───────────────────────────────────────────
function VoiceRecorderButton({
  voiceUri,
  onRecorded,
  onClear,
}: {
  voiceUri: string | null;
  onRecorded: (uri: string) => void;
  onClear: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_SECS = 120;

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Please allow microphone access in your device settings.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s + 1 >= MAX_SECS) {
            stopRecording();
            return MAX_SECS;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    clearInterval(timerRef.current!);
    setIsRecording(false);
    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    if (uri) onRecorded(uri);
    recordingRef.current = null;
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View>
      <Text style={styles.inputLabel}>
        Voice Message <Text style={styles.optional}>(optional)</Text>
      </Text>
      {voiceUri ? (
        <View style={styles.voicePreview}>
          <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
          <Text style={styles.voicePreviewText}>Voice recorded ✓</Text>
          <TouchableOpacity onPress={onClear} style={styles.clearBtnSmall}>
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.mediaBtn, isRecording && styles.mediaBtnRecording]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isRecording ? 'stop-circle' : 'mic'}
            size={20}
            color={isRecording ? Colors.error : Colors.primary}
          />
          <Text style={styles.mediaBtnText}>
            {isRecording ? `Stop Recording  ${formatTime(seconds)}` : 'Record Voice Message'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── FORM FIELD ───────────────────────────────────────────────
function FormField({
  label,
  required,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.inputLabel}>
        {label}{' '}
        {required ? (
          <Text style={styles.required}>*</Text>
        ) : (
          <Text style={styles.optional}>(optional)</Text>
        )}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
      />
    </View>
  );
}

// ─── BREAKDOWN ENQUIRY FORM ───────────────────────────────────
function BreakdownForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [machineType, setMachineType] = useState('');
  const [supportType, setSupportType] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    const cd = checkCooldown('breakdown');
    if (cd.blocked) {
      Alert.alert('Please Wait', `You recently sent an enquiry. Please wait ${cd.minutesLeft} more minute(s) before submitting again, or call us at 9109190790.`);
      return;
    }

    try {
      const safeData = sanitizeFormData({ name, phone, email, location, machineType, supportType });
      setLoading(true);
      await submitBreakdownEnquiry({
        machineType: safeData.machineType,
        supportType: safeData.supportType,
        name: safeData.name,
        phone: safeData.phone,
        email: safeData.email,
        location: safeData.location,
      });
      lastSubmit['breakdown'] = Date.now();
      setSuccess(true);
      setName(''); setPhone(''); setEmail(''); setLocation('');
      setPhotoUri(null); setVoiceUri(null);
      setStep(1); setMachineType(''); setSupportType('');
    } catch (err) {
      if (err instanceof ValidationError) {
        Alert.alert('Invalid Input', err.message);
      } else {
        Alert.alert('Error', 'Could not send enquiry. Please try again or call us at 9109190790.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.successBox}>
        <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
        <Text style={styles.successTitle}>Enquiry Sent!</Text>
        <Text style={styles.successDesc}>
          We'll contact you shortly. For urgent help, call 9109190790.
        </Text>
        <TouchableOpacity
          style={styles.newEnquiryBtn}
          onPress={() => { setSuccess(false); setStep(1); }}
        >
          <Text style={styles.newEnquiryBtnText}>Send Another Enquiry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Step 1: Machine Type
  if (step === 1) {
    return (
      <View>
        <Text style={styles.stepTitle}>
          <Text style={styles.stepNum}>1</Text> Select Machine Type
        </Text>
        <View style={styles.selectionGrid}>
          {MACHINE_TYPES.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.selectionCard}
              onPress={() => { setMachineType(m.label); setStep(2); }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="cog" size={28} color={Colors.primary} />
              <Text style={styles.selectionCardText}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // Step 2: Support Type
  if (step === 2) {
    return (
      <View>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
          <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>{machineType}</Text>
        </View>
        <Text style={styles.stepTitle}>
          <Text style={styles.stepNum}>2</Text> Select Support Type
        </Text>
        <View style={styles.selectionGrid}>
          {SUPPORT_TYPES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.selectionCard, styles.selectionCardWide]}
              onPress={() => { setSupportType(s.label); setStep(3); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={s.id === 'electrical' ? 'flash' : s.id === 'mechanical' ? 'build' : 'ellipsis-horizontal'}
                size={28}
                color={Colors.primary}
              />
              <Text style={styles.selectionCardText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // Step 3: Form
  return (
    <View>
      <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
        <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
        <Text style={styles.backBtnText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.badgeRow}>
        <View style={styles.selectedBadge}><Text style={styles.selectedBadgeText}>{machineType}</Text></View>
        <View style={styles.selectedBadge}><Text style={styles.selectedBadgeText}>{supportType}</Text></View>
      </View>
      <Text style={styles.stepTitle}><Text style={styles.stepNum}>3</Text> Your Details</Text>

      <FormField label="Full Name" required placeholder="Your name" value={name} onChangeText={setName} />
      <FormField label="Contact Number" required placeholder="10-digit mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <FormField label="Email" placeholder="Your email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <FormField label="Location / Address" required placeholder="Where is the machine?" value={location} onChangeText={setLocation} />

      <PhotoPickerButton photoUri={photoUri} onPick={pickPhoto} onClear={() => setPhotoUri(null)} />
      <View style={{ height: 12 }} />
      <VoiceRecorderButton voiceUri={voiceUri} onRecorded={setVoiceUri} onClear={() => setVoiceUri(null)} />

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
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
    </View>
  );
}

// ─── PART / OTHER SERVICE FORM ────────────────────────────────
function SimpleServiceForm({ type }: { type: 'part' | 'service-other' }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    const cd = checkCooldown(type);
    if (cd.blocked) {
      Alert.alert('Please Wait', `You recently sent an enquiry. Please wait ${cd.minutesLeft} more minute(s) before submitting again.`);
      return;
    }

    try {
      const safeData = sanitizeFormData({ name, phone, email, location });
      setLoading(true);
      if (type === 'part') {
        await submitPartEnquiry({ name: safeData.name, phone: safeData.phone, email: safeData.email, location: safeData.location });
      } else {
        await submitOtherServiceEnquiry({ name: safeData.name, phone: safeData.phone, email: safeData.email, location: safeData.location });
      }
      lastSubmit[type] = Date.now();
      setSuccess(true);
      setName(''); setPhone(''); setEmail(''); setLocation('');
      setPhotoUri(null); setVoiceUri(null);
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

  if (success) {
    return (
      <View style={styles.successBox}>
        <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
        <Text style={styles.successTitle}>Enquiry Sent!</Text>
        <Text style={styles.successDesc}>We'll contact you shortly.</Text>
        <TouchableOpacity style={styles.newEnquiryBtn} onPress={() => setSuccess(false)}>
          <Text style={styles.newEnquiryBtnText}>Send Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <FormField label="Full Name" required placeholder="Your name" value={name} onChangeText={setName} />
      <FormField label="Contact Number" required placeholder="10-digit mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <FormField label="Email" placeholder="Your email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <FormField label="Location / Address" required placeholder="Your location" value={location} onChangeText={setLocation} />

      <PhotoPickerButton photoUri={photoUri} onPick={pickPhoto} onClear={() => setPhotoUri(null)} />
      <View style={{ height: 12 }} />
      <VoiceRecorderButton voiceUri={voiceUri} onRecorded={setVoiceUri} onClear={() => setVoiceUri(null)} />

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
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
    </View>
  );
}

// ─── MAIN SERVICE SCREEN ──────────────────────────────────────
type SubTab = 'breakdown' | 'part' | 'other';

export default function ServiceScreen() {
  const { tab } = useLocalSearchParams<{ tab?: SubTab }>();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('breakdown');

  useEffect(() => {
    if (tab === 'breakdown' || tab === 'part' || tab === 'other') {
      setActiveSubTab(tab);
    }
  }, [tab]);

  const SUB_TABS: { key: SubTab; label: string; icon: string }[] = [
    { key: 'breakdown', label: 'Breakdown', icon: 'alert-circle' },
    { key: 'part', label: 'Part Enquiry', icon: 'cog' },
    { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <MaterialCommunityIcons name="wrench-cog" size={22} color={Colors.primary} />
        <Text style={styles.screenTitle}>Service Enquiry</Text>
      </View>

      {/* Sub-tabs */}
      <View style={styles.subTabRow}>
        {SUB_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.subTab, activeSubTab === tab.key && styles.subTabActive]}
            onPress={() => setActiveSubTab(tab.key)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={activeSubTab === tab.key ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.subTabText, activeSubTab === tab.key && styles.subTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.formContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeSubTab === 'breakdown' && <BreakdownForm />}
        {activeSubTab === 'part' && (
          <>
            <Text style={styles.formIntro}>
              Tell us about the part you need — send a photo or voice note for faster assistance.
            </Text>
            <SimpleServiceForm type="part" />
          </>
        )}
        {activeSubTab === 'other' && (
          <>
            <Text style={styles.formIntro}>
              Any other service query? Send us details below.
            </Text>
            <SimpleServiceForm type="service-other" />
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────
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
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 8,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabActive: { borderBottomColor: Colors.primary },
  subTabText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
  },
  subTabTextActive: { color: Colors.primary },
  scroll: { flex: 1 },
  formContainer: { padding: 16, paddingBottom: 60 },
  formIntro: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  // ── Steps ──
  stepTitle: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  stepNum: {
    fontFamily: 'Montserrat_900Black',
    fontSize: 20,
    color: Colors.primary,
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
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  selectedBadgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  // ── Selection Grid ──
  selectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectionCard: {
    width: (SCREEN_W - 52) / 3,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectionCardWide: {
    width: (SCREEN_W - 42) / 2,
  },
  selectionCardText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  // ── Form Fields ──
  fieldContainer: { marginBottom: 14 },
  inputLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  required: { color: Colors.primary, fontFamily: 'Montserrat_700Bold' },
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
  inputMultiline: { height: 100, textAlignVertical: 'top' },
  // ── Media ──
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
  },
  mediaBtnRecording: { borderColor: Colors.error },
  mediaBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
  },
  photoPreview: { gap: 8 },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: Colors.bgCard,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  clearBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  voicePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 8,
    padding: 14,
  },
  voicePreviewText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: Colors.success,
    flex: 1,
  },
  clearBtnSmall: { padding: 4 },
  // ── Submit ──
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 10,
    marginTop: 20,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // ── Success ──
  successBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  successTitle: {
    fontFamily: 'Montserrat_900Black',
    fontSize: 22,
    color: Colors.success,
  },
  successDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  newEnquiryBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  newEnquiryBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: Colors.primary,
  },
});

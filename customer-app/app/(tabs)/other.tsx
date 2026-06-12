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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import { sanitizeFormData, ValidationError } from '../../lib/sanitize';
import { submitGeneralEnquiry } from '../../lib/submitEnquiry';

const COOLDOWN_MS = 15 * 60 * 1000;
const lastSubmit: Record<string, number> = {};

function checkCooldown(key: string) {
  const last = lastSubmit[key];
  if (!last) return { blocked: false };
  const elapsed = Date.now() - last;
  if (elapsed < COOLDOWN_MS) return { blocked: true, minutesLeft: Math.ceil((COOLDOWN_MS - elapsed) / 60000) };
  return { blocked: false };
}

export default function OtherScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const cd = checkCooldown('other');
    if (cd.blocked) {
      Alert.alert('Please Wait', `You recently sent an enquiry. Please wait ${cd.minutesLeft} more minute(s).`);
      return;
    }
    try {
      const safeData = sanitizeFormData({ name, phone, email, message });
      setLoading(true);
      await submitGeneralEnquiry({
        name: safeData.name,
        phone: safeData.phone,
        email: safeData.email,
        message: safeData.message,
      });
      lastSubmit['other'] = Date.now();
      setSuccess(true);
      setName(''); setPhone(''); setEmail(''); setMessage('');
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <Ionicons name="chatbubble-ellipses" size={22} color={Colors.primary} />
        <Text style={styles.screenTitle}>Contact Us</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Quick Contact Options */}
        <View style={styles.quickContactRow}>
          <TouchableOpacity
            style={[styles.quickContactBtn, { backgroundColor: Colors.primary }]}
            onPress={() => Linking.openURL('tel:9109190790')}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.quickContactBtnText}>Call Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickContactBtn, { backgroundColor: Colors.whatsapp }]}
            onPress={() => {
              const msg = encodeURIComponent('Hello Nexus Machinery, I need assistance. Please contact me.');
              Linking.openURL(`https://wa.me/919109190790?text=${msg}`);
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="whatsapp" size={18} color="#fff" />
            <Text style={styles.quickContactBtnText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR SEND AN ENQUIRY</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* General Enquiry Form */}
        <Text style={styles.formIntro}>
          Have a question or requirement not listed above? Tell us and we'll get back to you.
        </Text>

        {success ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
            <Text style={styles.successTitle}>Enquiry Sent!</Text>
            <Text style={styles.successDesc}>We'll get back to you shortly.</Text>
            <TouchableOpacity style={styles.newBtn} onPress={() => setSuccess(false)}>
              <Text style={styles.newBtnText}>Send Another</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {[
              { label: 'Full Name', req: true, ph: 'Your name', val: name, set: setName, kb: 'default' as const },
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

            <View style={styles.fieldContainer}>
              <Text style={styles.inputLabel}>
                Your Message <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Describe your requirement..."
                placeholderTextColor={Colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

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

        {/* Address */}
        <View style={styles.addressCard}>
          <Text style={styles.addressTitle}>Our Location</Text>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <Text style={styles.addressText}>
              Balaji Complex, 4/10 Corner, Gondal Rd, Rajkot, Gujarat
            </Text>
          </View>
          <View style={styles.addressRow}>
            <Ionicons name="call" size={16} color={Colors.primary} />
            <Text style={styles.addressText}>9109190790</Text>
          </View>
        </View>

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
  quickContactRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  quickContactBtnText: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.3,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  formIntro: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
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
  inputMultiline: { height: 120, textAlignVertical: 'top' },
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
  successBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  successTitle: {
    fontFamily: 'Montserrat_900Black',
    fontSize: 24,
    color: Colors.success,
  },
  successDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
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
  addressCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 24,
    gap: 10,
  },
  addressTitle: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  addressText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 19,
  },
});

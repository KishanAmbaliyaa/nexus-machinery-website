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
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import { STATIC_NEW_PRODUCTS, STATIC_USED_PRODUCTS } from '../../constants/machines';
import { sanitizeFormData, ValidationError } from '../../lib/sanitize';
import { submitProductEnquiry } from '../../lib/submitEnquiry';

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

// ─── ENQUIRY MODAL ────────────────────────────────────────────
function EnquiryModal({
  visible,
  productName,
  category,
  onClose,
}: {
  visible: boolean;
  productName: string;
  category: 'new' | 'used';
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setName(''); setCompany(''); setPhone(''); setEmail('');
    setSuccess(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    const cd = checkCooldown('product');
    if (cd.blocked) {
      Alert.alert('Please Wait', `You recently sent an enquiry. Please wait ${cd.minutesLeft} more minute(s) before submitting again.`);
      return;
    }
    try {
      const safeData = sanitizeFormData({ name, phone, email, company, productName });
      setLoading(true);
      await submitProductEnquiry({
        category,
        productName: safeData.productName,
        name: safeData.name,
        company: safeData.company,
        phone: safeData.phone,
        email: safeData.email,
      });
      lastSubmit['product'] = Date.now();
      setSuccess(true);
    } catch (err) {
      if (err instanceof ValidationError) {
        Alert.alert('Invalid Input', err.message);
      } else {
        Alert.alert('Error', 'Could not send enquiry. Please call 9109190790.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Text style={styles.modalTitle}>Machine Enquiry</Text>
              <Text style={styles.modalSubtitle} numberOfLines={2}>{productName}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {success ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
                <Text style={styles.successTitle}>Enquiry Sent!</Text>
                <Text style={styles.successDesc}>Our sales team will contact you soon.</Text>
                <TouchableOpacity style={styles.closeSuccessBtn} onPress={handleClose}>
                  <Text style={styles.closeSuccessBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Fields */}
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── PRODUCT CARD ─────────────────────────────────────────────
function ProductCard({
  product,
  onEnquire,
}: {
  product: (typeof STATIC_NEW_PRODUCTS)[number] | (typeof STATIC_USED_PRODUCTS)[number];
  onEnquire: () => void;
}) {
  return (
    <View style={styles.productCard}>
      <View style={[styles.badge, product.category === 'new' ? styles.badgeNew : styles.badgeUsed]}>
        <Text style={styles.badgeText}>{product.category === 'new' ? 'NEW' : 'PRE-OWNED'}</Text>
      </View>
      <Image source={product.image} style={styles.productImage} resizeMode="contain" />
      <View style={styles.productInfo}>
        <View style={styles.typeTag}>
          <MaterialCommunityIcons name="cog" size={12} color={Colors.primary} />
          <Text style={styles.typeTagText}>{product.type}</Text>
        </View>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productDesc} numberOfLines={3}>{product.desc}</Text>
        <TouchableOpacity style={styles.enquireBtn} onPress={onEnquire} activeOpacity={0.85}>
          <Ionicons name="paper-plane" size={14} color="#fff" />
          <Text style={styles.enquireBtnText}>Send Enquiry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── MAIN MACHINES SCREEN ─────────────────────────────────────
type Filter = 'all' | 'new' | 'used';

export default function MachinesScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    name: string;
    category: 'new' | 'used';
  } | null>(null);

  const allProducts = [
    ...STATIC_NEW_PRODUCTS,
    ...STATIC_USED_PRODUCTS,
  ];

  const filtered =
    filter === 'all'
      ? allProducts
      : filter === 'new'
      ? STATIC_NEW_PRODUCTS
      : STATIC_USED_PRODUCTS;

  const openModal = (name: string, category: 'new' | 'used') => {
    setSelectedProduct({ name, category });
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <MaterialCommunityIcons name="robot-industrial" size={22} color={Colors.primary} />
        <Text style={styles.screenTitle}>Machines for Sale</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'new', 'used'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All' : f === 'new' ? 'New' : 'Pre-Owned'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Product grid */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.resultCount}>
          {filtered.length} machine{filtered.length !== 1 ? 's' : ''} available
        </Text>
        {filtered.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onEnquire={() => openModal(p.name, p.category)}
          />
        ))}
        <View style={styles.noteBox}>
          <Ionicons name="information-circle" size={18} color={Colors.textMuted} />
          <Text style={styles.noteText}>
            No prices shown — enquiry-based model only. Contact us for competitive pricing.
          </Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Enquiry Modal */}
      {selectedProduct && (
        <EnquiryModal
          visible={modalVisible}
          productName={selectedProduct.name}
          category={selectedProduct.category}
          onClose={() => setModalVisible(false)}
        />
      )}
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
  filterRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: Colors.textMuted,
  },
  filterTabTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  grid: { padding: 16, gap: 16 },
  resultCount: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  productCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeNew: { backgroundColor: Colors.badgeNew },
  badgeUsed: { backgroundColor: Colors.badgeUsed },
  badgeText: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.5,
  },
  productImage: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.bgCardElevated,
  },
  productInfo: { padding: 16, gap: 8 },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  typeTagText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  productDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  enquireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  enquireBtnText: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 13,
    color: '#fff',
    letterSpacing: 0.3,
  },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    marginTop: 8,
  },
  noteText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    flex: 1,
  },
  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlayDark,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 34,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  modalHeaderLeft: { flex: 1 },
  modalTitle: {
    fontFamily: 'Montserrat_900Black',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgCardElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { padding: 20, paddingBottom: 40 },
  // ── Form ──
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
  // ── Success ──
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
    textAlign: 'center',
  },
  closeSuccessBtn: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  closeSuccessBtnText: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 15,
    color: '#fff',
  },
});

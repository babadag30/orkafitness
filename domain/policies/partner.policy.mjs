/* Orka EMS Fitness — partner ilişkisi
   Kaynak: v0.5 §6

   İlişki simetriktir: bağ tek satırda tutulur, iki yönden de bulunur.
   Üye tüm üyeler arasından partner seçemez; yalnızca yöneticinin kurduğu
   bağ çözümlenir. Bu yüzden burada "arama" değil "çözümleme" var. */

import { allow, deny, ReasonCode } from '../core/result.mjs';

/** Bağ aktif mi? endedAt dolmuşsa geçmiştir. */
const isLinkActive = (link) => link.active === true && link.endedAt == null;

/** Üyenin aktif bağını simetrik olarak bulur. */
export function findActiveLink(memberId, links = []) {
  return links.find(l =>
    isLinkActive(l) && (l.memberAId === memberId || l.memberBId === memberId)
  ) ?? null;
}

/**
 * Üyenin partnerini çözümler. v0.5 §6 — Ahmet çift modunu seçerse Ayşe,
 * Ayşe seçerse Ahmet otomatik gelir.
 *
 * @returns RuleResult; başarılıysa metadata.partner ve metadata.link dolu
 */
export function resolveLinkedPartner({ memberId, links = [], members = new Map() }) {
  const link = findActiveLink(memberId, links);
  if (!link) {
    return deny(ReasonCode.PARTNER_NOT_LINKED, {
      internalReason: `Üyenin aktif partner bağı yok (member=${memberId})`,
      adminMessage: 'Bu üyenin tanımlı bir EMS partneri yok. Önce üye kartından partner tanımla.'
    });
  }

  const partnerId = link.memberAId === memberId ? link.memberBId : link.memberAId;
  const partner = members instanceof Map ? members.get(partnerId) : members[partnerId];

  if (!partner) {
    return deny(ReasonCode.PARTNER_NOT_LINKED, {
      internalReason: `Bağ var ama partner kaydı bulunamadı (partner=${partnerId})`,
      adminMessage: 'Partner kaydı bulunamadı. Veri tutarsızlığı — yönetici kontrol etmeli.',
      metadata: { partnerId }
    });
  }

  if (partner.active !== true) {
    return deny(ReasonCode.PARTNER_INACTIVE, {
      internalReason: `Partner pasif (partner=${partnerId})`,
      adminMessage: `${partner.name ?? partnerId} pasif durumda; çift seansı açılamaz.`,
      metadata: { partnerId, partner }
    });
  }

  return allow({ partner, partnerId, link });
}

/**
 * Yöneticinin yeni bağ kurmasını doğrular. v0.5 §6.
 * Veritabanı kısıtlarının domain karşılığı — Phase 2'de aynı kurallar
 * UNIQUE/CHECK olarak da yazılacak, ama tek doğruluk kaynağı burası.
 */
export function validatePartnerLink({ memberAId, memberBId, links = [], members = new Map() }) {
  const get = (id) => (members instanceof Map ? members.get(id) : members[id]);

  if (memberAId === memberBId) {
    return deny(ReasonCode.PARTNER_SELF_LINK, {
      internalReason: 'Üye kendisiyle eşleştirilemez',
      adminMessage: 'Bir üye kendisiyle partner yapılamaz.'
    });
  }

  const a = get(memberAId);
  const b = get(memberBId);
  for (const [id, m] of [[memberAId, a], [memberBId, b]]) {
    if (!m) {
      return deny(ReasonCode.PARTNER_NOT_LINKED, {
        internalReason: `Üye bulunamadı: ${id}`,
        adminMessage: 'Seçilen üye bulunamadı.'
      });
    }
    if (m.active !== true) {
      return deny(ReasonCode.PARTNER_INACTIVE, {
        internalReason: `Pasif üye bağlanamaz: ${id}`,
        adminMessage: `${m.name ?? id} pasif durumda; partner olarak tanımlanamaz.`,
        metadata: { memberId: id }
      });
    }
  }

  // Aynı çift zaten bağlı mı?
  const samePair = links.find(l => isLinkActive(l) && (
    (l.memberAId === memberAId && l.memberBId === memberBId) ||
    (l.memberAId === memberBId && l.memberBId === memberAId)
  ));
  if (samePair) {
    return deny(ReasonCode.PARTNER_DUPLICATE_LINK, {
      internalReason: 'Bu çift zaten aktif olarak bağlı',
      adminMessage: 'Bu iki üye zaten partner.',
      metadata: { linkId: samePair.id ?? null }
    });
  }

  // v0.5 §6 PROVISIONAL — üye başına tek aktif partner.
  for (const id of [memberAId, memberBId]) {
    const existing = findActiveLink(id, links);
    if (existing) {
      return deny(ReasonCode.PARTNER_ALREADY_LINKED, {
        internalReason: `Üyenin zaten aktif bağı var: ${id}`,
        adminMessage: `${get(id)?.name ?? id} için zaten bir partner tanımlı. Önce mevcut bağ sonlandırılmalı.`,
        metadata: { memberId: id, existingLinkId: existing.id ?? null }
      });
    }
  }

  return allow({ memberAId, memberBId });
}

/**
 * Bağı sonlandırır. Kayıt silinmez — denetlenebilirlik için kapatılır (v0.5 §6).
 * @returns yeni bağ nesnesi (çağıran kalıcılaştırır)
 */
export function endPartnerLink(link, { endedAt, actorId, reason } = {}) {
  return Object.freeze({
    ...link,
    active: false,
    endedAt: endedAt ?? Date.now(),
    endedBy: actorId ?? null,
    endReason: reason ?? null
  });
}

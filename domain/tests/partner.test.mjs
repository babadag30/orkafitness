/* v0.5 §6 — partner ilişkisi simetriktir ve yönetici tarafından kurulur */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ReasonCode, resolveLinkedPartner, validatePartnerLink, endPartnerLink } from '../index.mjs';
import { canBookCoupleEMS } from '../index.mjs';
import { coupleWorld, makeWorld } from './_fixtures.mjs';

test('Ahmet çözümlenince Ayşe gelir', () => {
  const w = coupleWorld();
  const r = resolveLinkedPartner({ memberId: 'ahmet', links: w.links, members: w.members });
  assert.equal(r.allowed, true);
  assert.equal(r.metadata.partnerId, 'ayse');
});

test('Ayşe çözümlenince Ahmet gelir — bağ simetrik', () => {
  const w = coupleWorld();
  const r = resolveLinkedPartner({ memberId: 'ayse', links: w.links, members: w.members });
  assert.equal(r.allowed, true);
  assert.equal(r.metadata.partnerId, 'ahmet');
});

test('her iki üye de çift randevusunu başlatabilir', () => {
  const w = coupleWorld();
  assert.equal(canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() }).allowed, true);
  assert.equal(canBookCoupleEMS({ initiatorMemberId: 'ayse', ctx: w.ctx() }).allowed, true);
});

test('bağı olmayan üye çift randevusu açamaz', () => {
  const w = makeWorld().member('tek').pkg('tek');
  const r = canBookCoupleEMS({ initiatorMemberId: 'tek', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PARTNER_NOT_LINKED);
});

test('kendisiyle eşleşme reddedilir', () => {
  const w = makeWorld().member('ahmet');
  const r = validatePartnerLink({ memberAId: 'ahmet', memberBId: 'ahmet', links: [], members: w.members });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PARTNER_SELF_LINK);
});

test('pasif partner çift randevusunu engeller', () => {
  const w = coupleWorld();
  w.members.get('ayse').active = false;
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PARTNER_INACTIVE);
});

test('sonlandırılmış bağ çözümlenmez', () => {
  const w = coupleWorld();
  w.links[0] = endPartnerLink(w.links[0], { endedAt: Date.now() });
  const r = resolveLinkedPartner({ memberId: 'ahmet', links: w.links, members: w.members });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PARTNER_NOT_LINKED);
});

test('aynı çift ikinci kez bağlanamaz', () => {
  const w = coupleWorld();
  const r = validatePartnerLink({
    memberAId: 'ahmet', memberBId: 'ayse', links: w.links, members: w.members
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PARTNER_DUPLICATE_LINK);
});

test('üye başına tek aktif partner — ikinci bağ reddedilir', () => {
  const w = coupleWorld().member('elif');
  const r = validatePartnerLink({
    memberAId: 'ahmet', memberBId: 'elif', links: w.links, members: w.members
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PARTNER_ALREADY_LINKED);
});

test('bağ sonlandıktan sonra yeni partner tanımlanabilir', () => {
  const w = coupleWorld().member('elif');
  w.links[0] = endPartnerLink(w.links[0]);
  const r = validatePartnerLink({
    memberAId: 'ahmet', memberBId: 'elif', links: w.links, members: w.members
  });
  assert.equal(r.allowed, true, r.internalReason);
});

test('pasif üye partner olarak tanımlanamaz', () => {
  const w = makeWorld().member('ahmet').member('elif', { active: false });
  const r = validatePartnerLink({
    memberAId: 'ahmet', memberBId: 'elif', links: [], members: w.members
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PARTNER_INACTIVE);
});

test('bağ sonlandırma kaydı denetlenebilir bilgi taşır', () => {
  const w = coupleWorld();
  const ended = endPartnerLink(w.links[0], { endedAt: 1234, actorId: 'admin-1', reason: 'ayrıldılar' });
  assert.equal(ended.active, false);
  assert.equal(ended.endedAt, 1234);
  assert.equal(ended.endedBy, 'admin-1');
  assert.equal(ended.endReason, 'ayrıldılar');
});

import { divRound } from '@savetowin/shared/stats'

export type EnvelopeStatus = 'ok' | 'tight' | 'over' | 'unused'

export type EnvelopeBar = {
  status: EnvelopeStatus
  /** % del límite usado (puede >100). */
  usedPercent: number
  /** Ancho del tramo “dentro del límite” en la barra (0–100). */
  withinBarPercent: number
  /** Ancho del tramo exceso (0 si no over). */
  overBarPercent: number
  remainingCents: number
  overCents: number
}

/** Directions 9b / 12a — barra y estado de un sobre. */
export function computeEnvelopeBar(
  spentCents: number,
  limitCents: number,
): EnvelopeBar {
  if (limitCents <= 0) {
    return {
      status: 'unused',
      usedPercent: 0,
      withinBarPercent: 0,
      overBarPercent: 0,
      remainingCents: 0,
      overCents: 0,
    }
  }

  const usedPercent = divRound(spentCents * 100, limitCents)
  const remainingCents = limitCents - spentCents

  if (spentCents === 0) {
    return {
      status: 'unused',
      usedPercent: 0,
      withinBarPercent: 0,
      overBarPercent: 0,
      remainingCents: limitCents,
      overCents: 0,
    }
  }

  if (spentCents > limitCents) {
    const withinBarPercent = divRound(limitCents * 100, spentCents)
    return {
      status: 'over',
      usedPercent,
      withinBarPercent,
      overBarPercent: 100 - withinBarPercent,
      remainingCents: 0,
      overCents: spentCents - limitCents,
    }
  }

  return {
    status: usedPercent >= 90 ? 'tight' : 'ok',
    usedPercent,
    withinBarPercent: Math.min(100, usedPercent),
    overBarPercent: 0,
    remainingCents,
    overCents: 0,
  }
}

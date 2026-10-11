// Retour haptique discret, réservé aux actions validées. Sans effet là où le navigateur ne le propose pas.
export function tap() {
  try {
    navigator.vibrate?.(8)
  } catch {
    /* rien */
  }
}

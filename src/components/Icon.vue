<script setup>
defineProps({ name: { type: String, required: true }, size: { type: Number, default: 24 } })

const PATHS = {
  today: '<rect x="3.5" y="5" width="17" height="15" rx="3.5"/><path d="M8 3v3.5M16 3v3.5M3.5 10h17"/><circle cx="12" cy="15" r="1.25" fill="currentColor" stroke="none"/>',
  money: '<circle cx="12" cy="12" r="8.75"/><path d="M15.2 9a3.9 3.9 0 1 0 0 6M7.6 11h5M7.6 13.2h5"/>',
  jobs: '<rect x="3.5" y="8" width="17" height="11.5" rx="2.75"/><path d="M9 8V6.6A1.6 1.6 0 0 1 10.6 5h2.8A1.6 1.6 0 0 1 15 6.6V8M3.5 13h17"/>',
  sport: '<path d="M8.5 12h7M2.75 10.5v3M21.25 10.5v3"/><rect x="5" y="7.5" width="3.5" height="9" rx="1.5"/><rect x="15.5" y="7.5" width="3.5" height="9" rx="1.5"/>',
  settings: '<path d="M4 7h8M18.5 7H20M4 12h1.5M12 12h8M4 17h6M16.5 17H20"/><circle cx="15.25" cy="7" r="2.25"/><circle cx="8.75" cy="12" r="2.25"/><circle cx="13.25" cy="17" r="2.25"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>',
  check: '<path pathLength="1" d="M5.5 12.5l4.25 4.25L18.5 8"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
}
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="size <= 16 ? 2.25 : 1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="PATHS[name]"
  />
</template>

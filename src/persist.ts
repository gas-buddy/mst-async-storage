const MMKV = require("react-native-mmkv")

export const mstStorage = new MMKV({
  id: "mst-storage",
})

export function save(key: string, snapshot: {}) {
  const data = JSON.stringify(snapshot)
  mstStorage.set(key, data)
}

export function load(key: string): object | undefined {
  try {
    const raw = mstStorage.getString(key)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch {}
  return undefined
}

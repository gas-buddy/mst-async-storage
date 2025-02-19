import test from "ava"
import * as td from "testdouble"
import { types } from "mobx-state-tree"

// --- setup mocking ----------------------------------------------------------

// Replace the react-native-mmkv module with our mock that uses the new API.
const MMKVMock = {
  getString: td.func(),
  set: td.func(),
}
td.replace("react-native-mmkv", MMKVMock)

// recreate before each run
test.beforeEach((t) => {
  MMKVMock.getString = td.func()
  MMKVMock.set = td.func()
})

// --- after mocking ----------------------------------------------------------

import { withAsyncStorage } from "../src/with-async-storage"

// --- fixtures ---------------------------------------------------------------

export const SampleModel = types
  .model({
    name: "",
    age: 0,
  })
  .actions((self) => ({
    setName(value: string) {
      self.name = value
    },
    setAge(value: number) {
      self.age = value
    },
  }))

const DefaultModel = SampleModel.extend(withAsyncStorage()).named("DefaultModel")
const KeyedModel = SampleModel.extend(withAsyncStorage({ key: "Jimmy" }))
const NoAutoSaveModel = SampleModel.extend(withAsyncStorage({ autoSave: false }))

// --- tests ------------------------------------------------------------------

test("loads only when asked", (t) => {
  DefaultModel.create()
  t.is(td.explain(MMKVMock.getString).callCount, 0)
})

test("mmkv loading", (t) => {
  DefaultModel.create().load()
  t.is(td.explain(MMKVMock.getString).callCount, 1)
})

test("custom key name", (t) => {
  KeyedModel.create().load()
  t.is(td.explain(MMKVMock.getString).calls[0].args[0], "Jimmy")
})

test("default key name", (t) => {
  DefaultModel.create().load()
  t.is(td.explain(MMKVMock.getString).calls[0].args[0], "DefaultModel")
})

test("won't autosave until loaded", (t) => {
  const model = DefaultModel.create()
  model.setAge(69)
  t.is(td.explain(MMKVMock.set).callCount, 0)
})

test("autosaves after 1st load", (t) => {
  const model = DefaultModel.create()
  model.load()
  model.setAge(69)
  t.is(td.explain(MMKVMock.set).callCount, 1)
})

test("autosave off", (t) => {
  const model = NoAutoSaveModel.create()
  model.load()
  model.setAge(69)
  t.is(td.explain(MMKVMock.set).callCount, 0)
})

test("saves proper data", (t) => {
  const model = DefaultModel.create()
  model.load()
  model.setAge(69)
  model.setName("jimmy")
  const ex = td.explain(MMKVMock.set)
  const [key, value] = ex.calls[1].args
  t.is(key, "DefaultModel")
  t.deepEqual(JSON.parse(value), { age: 69, name: "jimmy" })
})

test("save can be called manually", (t) => {
  const model = DefaultModel.create({ age: 1, name: "kid" })
  model.save()
  const ex = td.explain(MMKVMock.set)
  t.deepEqual(JSON.parse(ex.calls[0].args[1]), { age: 1, name: "kid" })
})

test("only", (t) => {
  const Model = SampleModel.extend(withAsyncStorage({ autoSave: false, only: ["age"] }))
  const model = Model.create({ age: 1, name: "kid" })
  model.save()
  const ex = td.explain(MMKVMock.set)
  t.deepEqual(JSON.parse(ex.calls[0].args[1]), { age: 1 })
})

test("only with bad key names", (t) => {
  const Model = SampleModel.extend(withAsyncStorage({ autoSave: false, only: ["lol"] }))
  const model = Model.create({ age: 1, name: "kid" })
  model.save()
  const ex = td.explain(MMKVMock.set)
  t.deepEqual(JSON.parse(ex.calls[0].args[1]), {})
})

test("except", (t) => {
  const Model = SampleModel.extend(withAsyncStorage({ autoSave: false, except: ["name"] }))
  const model = Model.create({ age: 1, name: "kid" })
  model.save()
  const ex = td.explain(MMKVMock.set)
  t.deepEqual(JSON.parse(ex.calls[0].args[1]), { age: 1 })
})

test("middleware", (t) => {
  const Model = SampleModel.extend(
    withAsyncStorage({
      autoSave: false,
      onLoad(snapshot) {
        return { name: "adult", ...snapshot }
      },
      onSave(snapshot) {
        const copy = { ...snapshot } as any
        delete copy.name
        return copy
      },
    }),
  )
  const model = Model.create({ age: 1, name: "kid" })
  model.save()
  const ex = td.explain(MMKVMock.set)
  t.deepEqual(JSON.parse(ex.calls[0].args[1]), { age: 1 })
  const loaded = Model.create()
  loaded.load()
  t.is(loaded.name, "adult")
})

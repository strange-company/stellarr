---
paths:
  - "engine/**"
  - "CMakeLists.txt"
---

# Engine (JUCE C++)

## Structure

- JUCE `AudioProcessorGraph` handles audio routing; `StellarrProcessor` owns the graph.
- Bridge handlers are split by domain in `engine/bridge/` (Preset, Graph, Scene, Midi, Param, InputBlock, Update handlers), all compiled as part of `StellarrBridge`.
- Declarations in headers, implementations in `.cpp` files.
- Settings persistence: JUCE `ApplicationProperties` / `PropertiesFile` under `~/Library/Application Support/Stellarr/`.
- Licence: AGPLv3 (required by JUCE). Every contribution and dependency must be compatible.

## Audio thread safety

These rules are absolute for anything reachable from `StellarrProcessor::processBlock`, a block's `processBlock` override in `engine/blocks/*.cpp`, or any audio callback.

- No heap allocation, no blocking lock, no logging, no file or network I/O on the audio thread.
- Never modify the `AudioProcessorGraph` from the audio thread.
- Batch graph mutations with `UpdateKind::none` and call `rebuildGraph()` once at the end. Never trigger N intermediate rebuilds, even if the result looks correct.
- Use `suspendProcessing(true)` on the top-level processor to synchronise with the audio thread (it acquires the `callbackLock`).
- Pre-create plugin instances (load binary, `prepareToPlay`) before suspending the graph, so the suspension window and audio gap stay minimal.
- Data shared between audio and message threads uses `std::atomic`. On the audio thread use `SpinLock::ScopedTryLockType` (non-blocking), never a blocking lock.
- Individual block `suspendProcessing` has no effect at graph level: the graph does not check `isSuspended()` on sub-nodes.

## Bridge contract

Events flow UI `sendEvent` -> C++ `handleEvent` -> `emitToJs` -> Zustand store. The TS side lives in `ui/src/bridge/index.ts` and `ui/src/store/index.ts`; the C++ side in `engine/StellarrBridge.cpp` and `engine/bridge/`. An event added, renamed or reshaped on only one side is structurally incomplete. Event names are shared via `engine/bridge/EventNames.h` and `ui/src/bridge/eventNames.ts`.

## Tests

- C++ test executables use a custom harness (each has its own `main()`), gated behind the `BUILD_TESTING` CMake flag. Shared helpers: `engine/test/TestUtils.h`, `engine/test/support/MockBridgeEmitter.h`.
- New audio processing features get a corresponding test in `engine/test/`, registered with `add_stellarr_test` in `CMakeLists.txt`.
- Anything that needs real plugins, audio hardware, or human judgement also gets a manual test case in `docs/testing/` (TC-XX-NNN format).
- Verify with `make debug` (build with tests) or `make test` (UI tests, then ctest).

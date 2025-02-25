# Webview Audio Playback Plan

This document outlines a step-by-step plan to remove native speaker references from the extension and implement audio playback using browser APIs in the webview panel.

## 1. Remove Native Speaker References

- **1.1. Identify and Remove SpeakerWrapper Usage**
  - Search for all references to `SpeakerWrapper` and any direct interactions with the native speaker module in the codebase (e.g., in `VoiceAgentService`, `AudioPlayer`, etc.).
  - Comment out and remove those sections that attempt to load and use the native `speaker.node` module.

- **1.2. Clean up Imports**
  - Remove the import of `SpeakerWrapper` from files such as `voice-agent-service.ts`, `dictation-service.ts`, and others that reference it.
  - Update any related type or interface declarations, if necessary.

## 2. Set Up Audio Playback in the Webview Panel

- **2.1. Send Audio Data to the Webview**
  - Modify the Voice Agent service so that instead of playing audio using the native speaker, it sends the raw audio data (e.g., PCM data from Deepgram) to the webview using the existing message passing mechanism.
  - Define a new message type (e.g., `playAudio`) that includes the audio data (likely in a suitable format such as a base64-encoded string or Blob URL).

- **2.2. Implement Audio Playback in the Webview**
  - In the webview HTML/JavaScript:
    - Set up a Web Audio API context.
    - Listen for incoming `playAudio` messages.
    - When receiving the message, convert the raw audio data to an appropriate format.
    - Use the `AudioContext.decodeAudioData` method to decode the PCM data if necessary. (Note: This may require converting the raw PCM into an ArrayBuffer if it isn't already.)
    - Create an `AudioBufferSourceNode` and connect it to the audio context destination.
    - Start playback of the audio buffer.

- **2.3. Fallback Option**
  - Alternatively, if converting PCM data is complex, consider streaming the audio data into a `Blob` and creating an object URL from it. Then, use an HTML `audio` element to play back the audio.

## 3. Update the Communication Between Extension and Webview

- **3.1. Modify Message Handlers**
  - Update the webview's `window.addEventListener('message', ...)` handler to handle the new `playAudio` message.
  - Ensure that existing messages (like transcript updates) remain unaffected.

- **3.2. Test Audio Sending and Reception**
  - Add logging in both the extension and webview code to verify that audio data is correctly sent and received.
  - Test with small chunks of audio data first.

## 4. Testing and Validation

- **4.1. Unit Test**
  - Test the modified VoiceAgentService to ensure that all audio data is forwarded to the webview as expected.
  
- **4.2. Webview Testing**
  - Verify that the Web Audio API correctly decodes and plays back the audio data without noticeable latency or quality issues.
  - Test in multiple environments (macOS, Windows, Linux) to ensure consistent behavior.

## 5. Final Clean Up

- **5.1. Remove Native Module Fallbacks**
  - Once the browser-based playback works reliably, remove the dummy speaker or any fallback code referencing the native `speaker` module.

- **5.2. Update Documentation**
  - Update the README or any developer documentation to reflect the changes in audio playback implementation.
  - Ensure that future development follows the webview-based playback approach for audio output.

## Additional Considerations

- **Audio Data Format**: Decide early on the format in which audio data will be sent from the extension (e.g., base64, ArrayBuffer) to minimize conversion work in the webview.
- **Latency**: Test for potential latency issues and optimize the decoding and playback process as needed.
- **Fallback UI**: Consider adding UI indicators in the webview in case audio playback fails.

This plan should guide the removal of native speaker dependencies and transition to a robust browser-based audio playback solution in the webview panel.

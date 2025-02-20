declare module 'node-microphone' {
  import { Readable } from 'stream'

  class Microphone {
    constructor(options?: { 
      rate?: number
      channels?: number
      device?: string 
    })
    
    startRecording(): Readable
    stopRecording(): void
  }

  export default Microphone
} 
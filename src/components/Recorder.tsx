'use client'

import { useState, useRef, useEffect } from 'react'
import { RecordingState, Question, Transcription } from '@/types'

interface RecorderProps {
  questions: Question[]
  projectId: string
  onTranscriptionComplete: (transcription: Transcription) => void
}

export default function Recorder({ questions, projectId, onTranscriptionComplete }: RecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
  })
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      })

      // Check for supported mime types and use the best available
      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4'
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/wav'
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              console.warn('No supported audio format found, using default')
              mimeType = ''
            }
          }
        }
      }
      
      console.log('Using mime type:', mimeType)
      
      const mediaRecorder = new MediaRecorder(stream, 
        mimeType ? { mimeType } : {}
      )

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const finalMimeType = mimeType || 'audio/webm'
        const audioBlob = new Blob(chunksRef.current, { type: finalMimeType })
        setRecordingState(prev => ({ ...prev, audioBlob }))
        
        stream.getTracks().forEach(track => track.stop())
        
        await handleTranscription(audioBlob)
      }

      mediaRecorder.start(1000) // Collect data every second
      
      setRecordingState({
        isRecording: true,
        isPaused: false,
        duration: 0,
      })

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: prev.duration + 1,
        }))
      }, 1000)

      setError('')
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.')
      console.error('Error starting recording:', err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState.isRecording) {
      mediaRecorderRef.current.stop()
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false,
      }))
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState.isRecording) {
      if (recordingState.isPaused) {
        mediaRecorderRef.current.resume()
        timerRef.current = setInterval(() => {
          setRecordingState(prev => ({
            ...prev,
            duration: prev.duration + 1,
          }))
        }, 1000)
      } else {
        mediaRecorderRef.current.pause()
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }

      setRecordingState(prev => ({
        ...prev,
        isPaused: !prev.isPaused,
      }))
    }
  }

  const handleTranscription = async (audioBlob: Blob) => {
    setIsTranscribing(true)
    setError('')

    try {
      console.log('Starting transcription process...')
      console.log('Audio blob size:', audioBlob.size, 'Type:', audioBlob.type)
      
      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('録音されたデータが空です。もう一度録音してください。')
      }
      
      if (audioBlob.size < 1000) { // Less than 1KB
        throw new Error('録音データが短すぎます。もう少し長く録音してください。')
      }

      // Determine file extension based on audio type
      const audioType = audioBlob.type
      let extension = '.webm'
      if (audioType.includes('mp4')) extension = '.m4a'
      else if (audioType.includes('wav')) extension = '.wav'
      else if (audioType.includes('ogg')) extension = '.ogg'
      
      const fileName = `interview${extension}`
      console.log('Creating form data with filename:', fileName)

      const formData = new FormData()
      formData.append('audio', audioBlob, fileName)
      formData.append('projectId', projectId)

      console.log('Sending transcription request...')
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `HTTPエラー: ${response.status}`
        throw new Error(`文字起こしに失敗しました: ${errorMessage}`)
      }

      const transcription: Transcription = await response.json()
      console.log('Transcription successful:', transcription)
      onTranscriptionComplete(transcription)
    } catch (err) {
      console.error('Transcription error:', err)
      setError(err instanceof Error ? err.message : '文字起こしに失敗しました')
    } finally {
      setIsTranscribing(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Record Interview</h2>
      
      {/* Questions Display */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Interview Questions</h3>
        <div className="space-y-3">
          {questions.map((question) => (
            <div key={question.id} className="p-4 bg-gray-50 rounded-lg">
              <span className="font-medium text-blue-600">Q{question.order}:</span>
              <span className="ml-2">{question.content}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recording Controls */}
      <div className="text-center space-y-6">
        <div className="text-4xl font-mono text-gray-800">
          {formatTime(recordingState.duration)}
        </div>

        <div className="flex justify-center space-x-4">
          {!recordingState.isRecording ? (
            <button
              onClick={startRecording}
              disabled={isTranscribing}
              className="bg-red-600 text-white px-6 py-3 rounded-full hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTranscribing ? 'Transcribing...' : 'Start Recording'}
            </button>
          ) : (
            <>
              <button
                onClick={pauseRecording}
                className="bg-yellow-600 text-white px-6 py-3 rounded-full hover:bg-yellow-700"
              >
                {recordingState.isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={stopRecording}
                className="bg-gray-600 text-white px-6 py-3 rounded-full hover:bg-gray-700"
              >
                Stop & Transcribe
              </button>
            </>
          )}
        </div>

        <div className="flex justify-center items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            recordingState.isRecording && !recordingState.isPaused 
              ? 'bg-red-500 animate-pulse' 
              : 'bg-gray-300'
          }`}></div>
          <span className="text-sm text-gray-600">
            {recordingState.isRecording 
              ? recordingState.isPaused 
                ? 'Recording Paused' 
                : 'Recording...'
              : 'Ready to Record'
            }
          </span>
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {isTranscribing && (
          <div className="text-blue-600 text-sm">
            Transcribing audio with OpenAI Whisper...
          </div>
        )}
      </div>
    </div>
  )
}
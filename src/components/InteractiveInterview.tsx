'use client'

import { useState, useRef, useEffect } from 'react'
import { Question, Transcription } from '@/types'

interface InteractiveInterviewProps {
  questions: Question[]
  projectId: string
  onInterviewComplete: (transcriptions: Transcription[]) => void
}

interface FollowUpItem {
  question: string
  isRecording: boolean
  isComplete: boolean
  duration: number
  transcription?: Transcription
  isEditing: boolean
  editedText: string
  audioBlob?: Blob
}

interface QuestionAnswer {
  question: Question
  transcription?: Transcription
  isRecording: boolean
  isComplete: boolean
  duration: number
  isEditing: boolean
  editedText: string
  followUpItems?: FollowUpItem[]
}

export default function InteractiveInterview({ questions, projectId, onInterviewComplete }: InteractiveInterviewProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>(
    questions.map(q => ({
      question: q,
      isRecording: false,
      isComplete: false,
      duration: 0,
      isEditing: false,
      editedText: '',
      followUpItems: []
    }))
  )
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const currentQuestion = questionAnswers[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1

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

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        await handleTranscription(audioBlob)
      }

      mediaRecorder.start(1000)
      
      // Update current question state
      setQuestionAnswers(prev => 
        prev.map((qa, index) => 
          index === currentQuestionIndex 
            ? { ...qa, isRecording: true, duration: 0 }
            : qa
        )
      )

      // Start timer
      timerRef.current = setInterval(() => {
        setQuestionAnswers(prev => 
          prev.map((qa, index) => 
            index === currentQuestionIndex 
              ? { ...qa, duration: qa.duration + 1 }
              : qa
          )
        )
      }, 1000)

      setError('')
    } catch (err) {
      setError('マイクへのアクセスに失敗しました。権限を確認してください。')
      console.error('Error starting recording:', err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && currentQuestion.isRecording) {
      mediaRecorderRef.current.stop()
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      setQuestionAnswers(prev => 
        prev.map((qa, index) => 
          index === currentQuestionIndex 
            ? { ...qa, isRecording: false }
            : qa
        )
      )
    }
  }

  const handleTranscription = async (audioBlob: Blob) => {
    setIsTranscribing(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, `question_${currentQuestionIndex + 1}.webm`)
      formData.append('projectId', projectId)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('文字起こしに失敗しました')
      }

      const transcription: Transcription = await response.json()
      
      // Update question with transcription
      setQuestionAnswers(prev => 
        prev.map((qa, index) => 
          index === currentQuestionIndex 
            ? { ...qa, transcription, isComplete: true, editedText: transcription.text }
            : qa
        )
      )

      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '文字起こしに失敗しました')
    } finally {
      setIsTranscribing(false)
    }
  }

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const startEditMode = () => {
    setQuestionAnswers(prev => 
      prev.map((qa, index) => 
        index === currentQuestionIndex 
          ? { ...qa, isEditing: true }
          : qa
      )
    )
  }

  const saveEditedText = () => {
    const currentQA = questionAnswers[currentQuestionIndex]
    if (currentQA.transcription && currentQA.editedText.trim()) {
      // Update transcription with edited text
      const updatedTranscription: Transcription = {
        ...currentQA.transcription,
        text: currentQA.editedText.trim()
      }
      
      setQuestionAnswers(prev => 
        prev.map((qa, index) => 
          index === currentQuestionIndex 
            ? { ...qa, transcription: updatedTranscription, isEditing: false }
            : qa
        )
      )
    }
  }

  const cancelEdit = () => {
    setQuestionAnswers(prev => 
      prev.map((qa, index) => 
        index === currentQuestionIndex 
          ? { ...qa, isEditing: false, editedText: qa.transcription?.text || '' }
          : qa
      )
    )
  }

  const handleTextChange = (newText: string) => {
    setQuestionAnswers(prev => 
      prev.map((qa, index) => 
        index === currentQuestionIndex 
          ? { ...qa, editedText: newText }
          : qa
      )
    )
  }

  const startReRecording = () => {
    // Reset current question state for re-recording
    setQuestionAnswers(prev => 
      prev.map((qa, index) => 
        index === currentQuestionIndex 
          ? { 
              ...qa, 
              isRecording: false, 
              isComplete: false, 
              duration: 0, 
              transcription: undefined,
              editedText: '',
              isEditing: false
            }
          : qa
      )
    )
  }

  const generateDeepDiveQuestion = async () => {
    if (!currentQuestion?.transcription?.text) return

    try {
      setError('')
      
      const response = await fetch('/api/generate-followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalQuestion: currentQuestion.question.content,
          answer: currentQuestion.transcription.text
        }),
      })

      if (!response.ok) {
        throw new Error('深掘り質問の生成に失敗しました')
      }

      const { followUpQuestion } = await response.json()

      const newFollowUpItem: FollowUpItem = {
        question: followUpQuestion,
        isRecording: false,
        isComplete: false,
        duration: 0,
        isEditing: false,
        editedText: ''
      }

      setQuestionAnswers(prev => 
        prev.map((qa, index) => 
          index === currentQuestionIndex 
            ? { 
                ...qa, 
                followUpItems: [...(qa.followUpItems || []), newFollowUpItem]
              }
            : qa
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '深掘り質問の生成に失敗しました')
    }
  }

  // Follow-up recording functions
  const startFollowUpRecording = async (followUpIndex: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.addEventListener('dataavailable', (event) => {
        chunksRef.current.push(event.data)
      })

      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' })
        setQuestionAnswers(prev => 
          prev.map((qa, index) => 
            index === currentQuestionIndex 
              ? { 
                  ...qa, 
                  followUpItems: qa.followUpItems?.map((item, idx) =>
                    idx === followUpIndex 
                      ? { ...item, audioBlob, isRecording: false }
                      : item
                  ) || []
                }
              : qa
          )
        )
        transcribeFollowUpAudio(followUpIndex, audioBlob)
      })

      mediaRecorder.start()
      
      setQuestionAnswers(prev => 
        prev.map((qa, index) => 
          index === currentQuestionIndex 
            ? { 
                ...qa, 
                followUpItems: qa.followUpItems?.map((item, idx) =>
                  idx === followUpIndex 
                    ? { ...item, isRecording: true, duration: 0 }
                    : item
                ) || []
              }
            : qa
        )
      )

      // Start timer
      timerRef.current = setInterval(() => {
        setQuestionAnswers(prev => 
          prev.map((qa, index) => 
            index === currentQuestionIndex 
              ? { 
                  ...qa, 
                  followUpItems: qa.followUpItems?.map((item, idx) =>
                    idx === followUpIndex 
                      ? { ...item, duration: item.duration + 1 }
                      : item
                  ) || []
                }
              : qa
          )
        )
      }, 1000)

    } catch (err) {
      setError('マイクへのアクセスが拒否されました')
    }
  }

  const stopFollowUpRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const transcribeFollowUpAudio = async (followUpIndex: number, audioBlob: Blob) => {
    setIsTranscribing(true)
    setError('')

    try {
      console.log('Transcribing follow-up audio, blob size:', audioBlob.size)
      
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      console.log('Transcribe response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Transcribe error:', errorData)
        throw new Error(errorData.error || '文字起こしに失敗しました')
      }

      const responseData = await response.json()
      console.log('Transcribe response data:', responseData)
      
      const { transcription } = responseData

      setQuestionAnswers(prev => 
        prev.map((qa, index) => 
          index === currentQuestionIndex 
            ? { 
                ...qa, 
                followUpItems: qa.followUpItems?.map((item, idx) =>
                  idx === followUpIndex 
                    ? { 
                        ...item, 
                        transcription: {
                          id: `followup-${Date.now()}`,
                          audioUrl: '',
                          text: transcription,
                          projectId,
                          createdAt: new Date()
                        },
                        isComplete: true,
                        editedText: transcription
                      }
                    : item
                ) || []
              }
            : qa
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '文字起こしに失敗しました')
    } finally {
      setIsTranscribing(false)
    }
  }

  // Follow-up editing functions
  const startFollowUpEdit = (followUpIndex: number) => {
    setQuestionAnswers(prev => 
      prev.map((qa, index) => 
        index === currentQuestionIndex 
          ? { 
              ...qa, 
              followUpItems: qa.followUpItems?.map((item, idx) =>
                idx === followUpIndex 
                  ? { 
                      ...item, 
                      isEditing: true, 
                      editedText: item.transcription?.text || ''
                    }
                  : item
              ) || []
            }
          : qa
      )
    )
  }

  const saveFollowUpEdit = (followUpIndex: number) => {
    setQuestionAnswers(prev => 
      prev.map((qa, index) => 
        index === currentQuestionIndex 
          ? { 
              ...qa, 
              followUpItems: qa.followUpItems?.map((item, idx) =>
                idx === followUpIndex 
                  ? { 
                      ...item, 
                      transcription: item.transcription ? {
                        ...item.transcription,
                        text: item.editedText.trim()
                      } : undefined,
                      isEditing: false
                    }
                  : item
              ) || []
            }
          : qa
      )
    )
  }

  const cancelFollowUpEdit = (followUpIndex: number) => {
    setQuestionAnswers(prev => 
      prev.map((qa, index) => 
        index === currentQuestionIndex 
          ? { 
              ...qa, 
              followUpItems: qa.followUpItems?.map((item, idx) =>
                idx === followUpIndex 
                  ? { 
                      ...item, 
                      isEditing: false, 
                      editedText: item.transcription?.text || ''
                    }
                  : item
              ) || []
            }
          : qa
      )
    )
  }

  const handleFollowUpTextChange = (followUpIndex: number, newText: string) => {
    setQuestionAnswers(prev => 
      prev.map((qa, index) => 
        index === currentQuestionIndex 
          ? { 
              ...qa, 
              followUpItems: qa.followUpItems?.map((item, idx) =>
                idx === followUpIndex 
                  ? { ...item, editedText: newText }
                  : item
              ) || []
            }
          : qa
      )
    )
  }

  const startFollowUpReRecording = (followUpIndex: number) => {
    setQuestionAnswers(prev => 
      prev.map((qa, index) => 
        index === currentQuestionIndex 
          ? { 
              ...qa, 
              followUpItems: qa.followUpItems?.map((item, idx) =>
                idx === followUpIndex 
                  ? { 
                      ...item, 
                      isRecording: false,
                      isComplete: false,
                      duration: 0,
                      transcription: undefined,
                      editedText: '',
                      isEditing: false,
                      audioBlob: undefined
                    }
                  : item
              ) || []
            }
          : qa
      )
    )
  }

  const generateNestedDeepDive = async (followUpIndex: number) => {
    const followUpItem = currentQuestion?.followUpItems?.[followUpIndex]
    if (!followUpItem?.transcription?.text) return

    try {
      setError('')
      
      const response = await fetch('/api/generate-followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalQuestion: followUpItem.question,
          answer: followUpItem.transcription.text
        }),
      })

      if (!response.ok) {
        throw new Error('深掘り質問の生成に失敗しました')
      }

      const { followUpQuestion } = await response.json()

      const newFollowUpItem: FollowUpItem = {
        question: followUpQuestion,
        isRecording: false,
        isComplete: false,
        duration: 0,
        isEditing: false,
        editedText: ''
      }

      setQuestionAnswers(prev => 
        prev.map((qa, index) => 
          index === currentQuestionIndex 
            ? { 
                ...qa, 
                followUpItems: [...(qa.followUpItems || []), newFollowUpItem]
              }
            : qa
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '深掘り質問の生成に失敗しました')
    }
  }

  const finishInterview = () => {
    // スキップした質問（transcriptionがない）は除外し、回答した質問のみを処理
    const completedTranscriptions = questionAnswers
      .filter(qa => qa.transcription && qa.transcription.text.trim()) // 空のtextも除外
      .map(qa => {
        let combinedText = qa.transcription!.text
        
        // Add follow-up Q&As to the transcription
        if (qa.followUpItems && qa.followUpItems.length > 0) {
          const followUpContent = qa.followUpItems
            .filter(item => item.transcription?.text && item.transcription.text.trim()) // 空のfollow-upも除外
            .map((item, index) => {
              return `\n\n【深掘り質問${index + 1}】${item.question}\n【深掘り回答${index + 1}】${item.transcription!.text}`
            })
            .join('')
          
          combinedText += followUpContent
        }
        
        return {
          ...qa.transcription!,
          text: combinedText
        }
      })
    
    onInterviewComplete(completedTranscriptions)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">対話形式インタビュー</h2>
      
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            質問 {currentQuestionIndex + 1} / {questions.length}
          </span>
          <span className="text-sm text-gray-500">
            {questionAnswers.filter(qa => qa.isComplete).length} 完了
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Current Question */}
      <div className="mb-8">
        <div className="bg-blue-50 p-6 rounded-lg mb-6">
          <div className="flex items-start space-x-3">
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
              Q{currentQuestion.question.order}
            </span>
            <div className="flex-1">
              <p className="text-lg text-gray-800 leading-relaxed">
                {currentQuestion.question.content}
              </p>
            </div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="text-center space-y-6">
          <div className="text-3xl font-mono text-gray-800">
            {formatTime(currentQuestion.duration)}
          </div>

          <div className="flex justify-center space-x-4">
            {!currentQuestion.isRecording && !currentQuestion.isComplete ? (
              <>
                <button
                  onClick={startRecording}
                  disabled={isTranscribing}
                  className="bg-red-600 text-white px-8 py-3 rounded-full hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {isTranscribing ? '文字起こし中...' : '回答を録音'}
                </button>
                {!isLastQuestion && (
                  <button
                    onClick={goToNextQuestion}
                    className="bg-gray-500 text-white px-6 py-3 rounded-full hover:bg-gray-600 text-lg"
                  >
                    スキップ
                  </button>
                )}
              </>
            ) : currentQuestion.isRecording ? (
              <button
                onClick={stopRecording}
                className="bg-gray-600 text-white px-8 py-3 rounded-full hover:bg-gray-700 text-lg"
              >
                録音停止
              </button>
            ) : null}
          </div>

          <div className="flex justify-center items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              currentQuestion.isRecording 
                ? 'bg-red-500 animate-pulse' 
                : currentQuestion.isComplete
                  ? 'bg-green-500'
                  : 'bg-gray-300'
            }`}></div>
            <span className="text-sm text-gray-600">
              {currentQuestion.isRecording 
                ? '録音中...'
                : currentQuestion.isComplete
                  ? '回答完了'
                  : '録音待機中'
              }
            </span>
          </div>
        </div>

        {/* Transcription Display */}
        {currentQuestion.transcription && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-green-800">回答内容:</h4>
              {!currentQuestion.isEditing && (
                <div className="flex space-x-2">
                  <button
                    onClick={startEditMode}
                    className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    ✏️ 編集
                  </button>
                  <button
                    onClick={startReRecording}
                    className="text-sm bg-orange-100 text-orange-700 px-3 py-1 rounded-md hover:bg-orange-200 transition-colors"
                  >
                    🎤 再録音
                  </button>
                </div>
              )}
            </div>
            
            {currentQuestion.isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={currentQuestion.editedText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="回答内容を編集してください..."
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveEditedText}
                    disabled={!currentQuestion.editedText.trim()}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {currentQuestion.transcription.text}
                </p>
                
                {/* Deep Dive Button */}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={generateDeepDiveQuestion}
                    className="text-sm bg-purple-100 text-purple-700 px-4 py-2 rounded-md hover:bg-purple-200 transition-colors font-medium"
                  >
                    🔍 回答を深掘る
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Follow-up Questions */}
        {currentQuestion.followUpItems && currentQuestion.followUpItems.length > 0 && (
          <div className="mt-6 space-y-4">
            {currentQuestion.followUpItems.map((followUpItem, index) => (
              <div key={index} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start space-x-3 mb-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    F{index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-800 mb-3">{followUpItem.question}</p>
                    
                    {/* Recording Controls */}
                    {!followUpItem.transcription && (
                      <div className="flex items-center space-x-3 mb-3">
                        {followUpItem.isRecording ? (
                          <button
                            onClick={stopFollowUpRecording}
                            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm"
                          >
                            🔴 録音停止
                          </button>
                        ) : (
                          <button
                            onClick={() => startFollowUpRecording(index)}
                            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm"
                          >
                            🎤 録音開始
                          </button>
                        )}
                        
                        {followUpItem.isRecording && (
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-purple-700 font-mono">
                              {formatTime(followUpItem.duration)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Transcription Display */}
                    {followUpItem.transcription && (
                      <div className="mt-3 p-3 bg-white border border-purple-300 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h5 className="text-sm font-medium text-purple-800">深掘り回答:</h5>
                          {!followUpItem.isEditing && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => startFollowUpEdit(index)}
                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                              >
                                ✏️ 編集
                              </button>
                              <button
                                onClick={() => startFollowUpReRecording(index)}
                                className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 transition-colors"
                              >
                                🎤 再録音
                              </button>
                              <button
                                onClick={() => generateNestedDeepDive(index)}
                                className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors"
                              >
                                🔍 さらに深掘る
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {followUpItem.isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={followUpItem.editedText}
                              onChange={(e) => handleFollowUpTextChange(index, e.target.value)}
                              className="w-full h-24 p-2 border border-purple-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                              placeholder="深掘り回答を編集してください..."
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => cancelFollowUpEdit(index)}
                                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                              >
                                キャンセル
                              </button>
                              <button
                                onClick={() => saveFollowUpEdit(index)}
                                disabled={!followUpItem.editedText.trim()}
                                className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {followUpItem.transcription.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 text-red-600 text-sm text-center">{error}</div>
        )}

        {isTranscribing && (
          <div className="mt-4 text-blue-600 text-sm text-center">
            OpenAI Whisperで文字起こし中...
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={goToPreviousQuestion}
          disabled={currentQuestionIndex === 0}
          className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          前の質問
        </button>

        <div className="flex space-x-2">
          {questionAnswers.map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full ${
                index === currentQuestionIndex
                  ? 'bg-blue-600'
                  : questionAnswers[index].isComplete
                    ? 'bg-green-500'
                    : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {!isLastQuestion ? (
          <button
            onClick={goToNextQuestion}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            次の質問
          </button>
        ) : (
          <button
            onClick={finishInterview}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
          >
            インタビュー完了
          </button>
        )}
      </div>

      {/* Question List Summary */}
      <div className="mt-8 pt-6 border-t">
        <h3 className="text-lg font-medium mb-4">質問一覧</h3>
        <div className="space-y-2">
          {questionAnswers.map((qa, index) => (
            <div
              key={qa.question.id}
              className={`p-3 rounded-lg text-sm ${
                index === currentQuestionIndex
                  ? 'bg-blue-50 border-2 border-blue-200'
                  : qa.isComplete
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  qa.isComplete
                    ? 'bg-green-600 text-white'
                    : index === currentQuestionIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-400 text-white'
                }`}>
                  {qa.isComplete ? '✓' : qa.question.order}
                </span>
                <span className="flex-1">{qa.question.content}</span>
                {qa.duration > 0 && (
                  <span className="text-xs text-gray-500">
                    {formatTime(qa.duration)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
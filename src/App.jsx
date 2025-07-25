import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { open } from '@tauri-apps/api/dialog'
import { readText, writeText } from '@tauri-apps/api/clipboard'
import { convertFileSrc } from '@tauri-apps/api/tauri'
import './App.css'

function App() {
  const [videoPath, setVideoPath] = useState('')
  const [chapters, setChapters] = useState([])
  const [selectedChapter, setSelectedChapter] = useState(null)
  const [selectedRows, setSelectedRows] = useState([]) // 複数行選択用
  const [lastSelectedRow, setLastSelectedRow] = useState(null) // Shift選択の基点
  const [selectedCells, setSelectedCells] = useState([]) // 複数セル選択用 [{row: number, field: 'time'|'title'}]
  const [editingCell, setEditingCell] = useState(null) // {row: number, field: 'time' | 'title'}
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [platform, setPlatform] = useState('')
  
  const videoRef = useRef(null)
  const animationFrameRef = useRef(null)

  useEffect(() => {
    // プラットフォームとテーマの検出
    invoke('get_platform').then(setPlatform)
    
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDarkMode(isDark)
    
    // テーマ変更の監視
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => setIsDarkMode(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // スムーズな時間更新
  useEffect(() => {
    if (videoRef.current) {
      const updateTime = () => {
        if (videoRef.current && !videoRef.current.paused) {
          setCurrentTime(videoRef.current.currentTime * 1000)
          animationFrameRef.current = requestAnimationFrame(updateTime)
        }
      }
      
      const handlePlay = () => {
        updateTime()
      }
      
      const handlePause = () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
      
      const handleTimeUpdate = () => {
        setCurrentTime(videoRef.current.currentTime * 1000)
      }
      
      videoRef.current.addEventListener('play', handlePlay)
      videoRef.current.addEventListener('pause', handlePause)
      videoRef.current.addEventListener('timeupdate', handleTimeUpdate)
      
      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('play', handlePlay)
          videoRef.current.removeEventListener('pause', handlePause)
          videoRef.current.removeEventListener('timeupdate', handleTimeUpdate)
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [videoPath])

  const openVideo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Video',
          extensions: ['mp4', 'm4v', 'avi', 'mkv', 'mov', 'MOV', 'ts', 'm2ts', 'mp3', 'webm']
        }]
      })
      
      if (selected) {
        console.log('Selected file:', selected)
        setVideoPath(selected)
      }
    } catch (error) {
      console.error('Error opening video:', error)
    }
  }

  const loadChapters = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Text',
          extensions: ['txt']
        }]
      })
      
      if (selected) {
        const loadedChapters = await invoke('load_chapters', { filePath: selected })
        setChapters(loadedChapters)
      }
    } catch (error) {
      console.error('Error loading chapters:', error)
    }
  }

  const saveChapters = async () => {
    if (!videoPath) {
      return
    }
    
    try {
      const basePath = videoPath.replace(/\.[^/.]+$/, '')
      const savePath = `${basePath}.txt`
      
      await invoke('save_chapters', { 
        filePath: savePath, 
        chapters: chapters 
      })
      
      console.log('Chapters saved to:', savePath)
    } catch (error) {
      console.error('Error saving chapters:', error)
    }
  }

  const addChapter = () => {
    const newChapter = { time: '', title: '' }
    
    // 選択位置の後に挿入
    if (selectedChapter !== null) {
      const newChapters = [...chapters]
      newChapters.splice(selectedChapter + 1, 0, newChapter)
      setChapters(newChapters)
      setSelectedChapter(selectedChapter + 1)
    } else {
      setChapters([...chapters, newChapter])
    }
  }

  const deleteChapter = (index) => {
    const newChapters = chapters.filter((_, i) => i !== index)
    setChapters(newChapters)
    if (selectedChapter === index) {
      setSelectedChapter(null)
    } else if (selectedChapter > index) {
      setSelectedChapter(selectedChapter - 1)
    }
    setSelectedRows([])
    setSelectedCells([])
  }

  const deleteMultiple = () => {
    // 複数行が選択されている場合
    if (selectedRows.length > 0) {
      const rowsToDelete = [...selectedRows].sort((a, b) => b - a) // 降順でソート
      const newChapters = chapters.filter((_, i) => !selectedRows.includes(i))
      setChapters(newChapters)
      setSelectedRows([])
      setSelectedChapter(null)
    }
    // 単一行が選択されている場合
    else if (selectedChapter !== null) {
      deleteChapter(selectedChapter)
    }
  }

  const updateChapter = (index, field, value) => {
    const newChapters = [...chapters]
    newChapters[index][field] = value
    setChapters(newChapters)
  }

  const sortChapters = async () => {
    const sorted = await Promise.all(
      chapters.map(async (chapter) => {
        const time = await invoke('parse_time', { timeStr: chapter.time })
        return { ...chapter, sortTime: time || 0 }
      })
    )
    
    sorted.sort((a, b) => a.sortTime - b.sortTime)
    setChapters(sorted.map(({ sortTime, ...chapter }) => chapter))
  }

  const jumpToTime = async () => {
    if (selectedChapter !== null && chapters[selectedChapter]) {
      const ms = await invoke('parse_time', { timeStr: chapters[selectedChapter].time })
      if (ms !== null && videoRef.current) {
        videoRef.current.currentTime = ms / 1000
      }
    }
  }

  const copyCurrentTime = async () => {
    try {
      const time = formatTimeDisplay(currentTime)
      await writeText(time)
      console.log('Copied to clipboard:', time)
      
      // 視覚的フィードバック
      const button = document.querySelector('.chapter-controls button:nth-child(2)')
      if (button) {
        const originalText = button.textContent
        button.textContent = '✓ Copied'
        setTimeout(() => {
          button.textContent = originalText
        }, 1000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
      // フォールバック
      try {
        const textArea = document.createElement('textarea')
        textArea.value = formatTimeDisplay(currentTime)
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        console.log('Copied using fallback method')
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr)
      }
    }
  }

  const pasteChapters = async () => {
    try {
      const text = await readText()
      if (text) {
        const parsed = await invoke('parse_youtube_chapters', { text })
        setChapters([...chapters, ...parsed])
      }
    } catch (error) {
      console.error('Error pasting chapters:', error)
    }
  }

  // 時間フォーマット関数（ミリ秒3桁表示）
  const formatTimeDisplay = (ms) => {
    const totalSeconds = ms / 1000
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    const secondsInt = Math.floor(seconds)
    const milliseconds = Math.round((seconds - secondsInt) * 1000)
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secondsInt.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
  }

  // セルクリックハンドラー
  const handleCellClick = (e, rowIndex, field) => {
    e.stopPropagation()
    e.preventDefault() // テキスト選択を防止
    
    const isMac = platform === 'macos'
    const isCtrlCmd = isMac ? e.metaKey : e.ctrlKey
    
    if (e.shiftKey && lastSelectedRow !== null) {
      // Shiftクリック：範囲選択
      const start = Math.min(lastSelectedRow, rowIndex)
      const end = Math.max(lastSelectedRow, rowIndex)
      const newSelectedRows = []
      for (let i = start; i <= end; i++) {
        newSelectedRows.push(i)
      }
      setSelectedRows(newSelectedRows)
      setSelectedChapter(rowIndex)
      // lastSelectedRowは変更しない（Shift選択の基点を保持）
    } else if (isCtrlCmd) {
      // Cmd/Ctrlクリック：個別選択の追加/削除
      let newSelectedRows = [...selectedRows]
      
      if (newSelectedRows.includes(rowIndex)) {
        // 既に選択されている場合は選択解除
        newSelectedRows = newSelectedRows.filter(r => r !== rowIndex)
        if (newSelectedRows.length === 0) {
          setSelectedChapter(null)
          setLastSelectedRow(null)
        } else {
          // 最後の選択行を新しい基点にする
          setSelectedChapter(newSelectedRows[newSelectedRows.length - 1])
          setLastSelectedRow(newSelectedRows[newSelectedRows.length - 1])
        }
      } else {
        // 選択されていない場合は追加
        newSelectedRows.push(rowIndex)
        setSelectedChapter(rowIndex)
        setLastSelectedRow(rowIndex)
      }
      
      setSelectedRows(newSelectedRows)
    } else {
      // 通常クリック：単一選択
      setSelectedChapter(rowIndex)
      setSelectedRows([])
      setLastSelectedRow(rowIndex)
    }
    setSelectedCells([])
  }

  // マウスダウンハンドラー（テキスト選択を防止）
  const handleMouseDown = (e) => {
    if (!editingCell) {
      e.preventDefault()
    }
  }

  // セルダブルクリックハンドラー
  const handleCellDoubleClick = (e, rowIndex, field) => {
    e.stopPropagation()
    setEditingCell({ row: rowIndex, field })
  }

  // 編集終了ハンドラー
  const handleEditEnd = () => {
    setEditingCell(null)
  }

  // 入力フィールドのキーダウンハンドラー
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEditEnd()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleEditEnd()
    }
    // Cmd+V/Ctrl+Vは通常の動作に任せる（handleKeyPressで処理しない）
  }

  // キーボードショートカット
  useEffect(() => {
    const handleKeyPress = (e) => {
      const ctrl = platform === 'macos' ? e.metaKey : e.ctrlKey
      
      // 編集中の場合はCmd+V/Ctrl+Vを通常のペースト動作に任せる
      if (editingCell && ctrl && e.key === 'v') {
        return // デフォルトの動作を許可
      }
      
      // 上下カーソルキーでの行移動
      if (!editingCell && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        
        if (e.shiftKey && selectedChapter !== null) {
          // Shift+上下で範囲選択
          let newSelectedRows = [...selectedRows]
          
          if (e.key === 'ArrowUp' && selectedChapter > 0) {
            const newPos = selectedChapter - 1
            const start = Math.min(lastSelectedRow ?? selectedChapter, newPos)
            const end = Math.max(lastSelectedRow ?? selectedChapter, newPos)
            newSelectedRows = []
            for (let i = start; i <= end; i++) {
              newSelectedRows.push(i)
            }
            setSelectedChapter(newPos)
            setSelectedRows(newSelectedRows)
          } else if (e.key === 'ArrowDown' && selectedChapter < chapters.length - 1) {
            const newPos = selectedChapter + 1
            const start = Math.min(lastSelectedRow ?? selectedChapter, newPos)
            const end = Math.max(lastSelectedRow ?? selectedChapter, newPos)
            newSelectedRows = []
            for (let i = start; i <= end; i++) {
              newSelectedRows.push(i)
            }
            setSelectedChapter(newPos)
            setSelectedRows(newSelectedRows)
          }
          setSelectedCells([])
        } else {
          // 通常の上下移動
          if (selectedChapter !== null) {
            if (e.key === 'ArrowUp' && selectedChapter > 0) {
              const newPos = selectedChapter - 1
              setSelectedChapter(newPos)
              setLastSelectedRow(newPos)
              setSelectedRows([])
              setSelectedCells([])
            } else if (e.key === 'ArrowDown' && selectedChapter < chapters.length - 1) {
              const newPos = selectedChapter + 1
              setSelectedChapter(newPos)
              setLastSelectedRow(newPos)
              setSelectedRows([])
              setSelectedCells([])
            }
          } else if (chapters.length > 0) {
            // 何も選択されていない場合は最初の行を選択
            setSelectedChapter(0)
            setLastSelectedRow(0)
            setSelectedRows([])
            setSelectedCells([])
          }
        }
      }
      
      if (ctrl) {
        switch (e.key) {
          case 'o':
            e.preventDefault()
            openVideo()
            break
          case 'l':
            e.preventDefault()
            loadChapters()
            break
          case 's':
            e.preventDefault()
            saveChapters()
            break
          case 'j':
            e.preventDefault()
            jumpToTime()
            break
          case 'v':
            e.preventDefault()
            pasteChapters()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [platform, selectedChapter, selectedRows, lastSelectedRow, chapters, editingCell])

  return (
    <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="header">
        <div className="menu-bar">
          <button onClick={openVideo}>File</button>
          <button onClick={() => {}}>Skip</button>
        </div>
        <div className="title">{videoPath ? videoPath.split('/').pop().split('\\').pop() : ''}</div>
      </div>
      
      <div className="main-content">
        <div className="video-section">
          <div className="video-wrapper">
            {videoPath ? (
              <video
                ref={videoRef}
                src={convertFileSrc(videoPath)}
                controls
                autoPlay
                className="video-element"
                onLoadedMetadata={(e) => {
                  setDuration(e.target.duration * 1000)
                  e.target.play()
                }}
                onError={(e) => {
                  console.error('Video playback error:', e)
                  const videoElement = e.target
                  if (videoElement.videoHeight === 0) {
                    console.log('Audio file detected')
                  }
                }}
              >
                <source src={convertFileSrc(videoPath)} type="video/mp4" />
                <source src={convertFileSrc(videoPath)} type="audio/mpeg" />
                <source src={convertFileSrc(videoPath)} type="audio/mp3" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="video-placeholder">
                <p>No video loaded</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="chapter-section">
          <div className="chapter-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Chapter</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((chapter, index) => (
                  <tr 
                    key={index}
                    className={
                      selectedRows.includes(index) ? 'selected multi-selected' : 
                      selectedChapter === index ? 'selected' : ''
                    }
                    onClick={() => {
                      setSelectedChapter(index)
                      setLastSelectedRow(index)
                      setSelectedRows([])
                      setSelectedCells([])
                    }}
                  >
                    <td 
                      onClick={(e) => handleCellClick(e, index, 'time')}
                      onDoubleClick={(e) => handleCellDoubleClick(e, index, 'time')}
                      onMouseDown={handleMouseDown}
                    >
                      {editingCell?.row === index && editingCell?.field === 'time' ? (
                        <input
                          type="text"
                          value={chapter.time}
                          onChange={(e) => updateChapter(index, 'time', e.target.value)}
                          onBlur={handleEditEnd}
                          onKeyDown={handleInputKeyDown}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <div className="cell-content">{chapter.time}</div>
                      )}
                    </td>
                    <td 
                      onClick={(e) => handleCellClick(e, index, 'title')}
                      onDoubleClick={(e) => handleCellDoubleClick(e, index, 'title')}
                      onMouseDown={handleMouseDown}
                    >
                      {editingCell?.row === index && editingCell?.field === 'title' ? (
                        <input
                          type="text"
                          value={chapter.title}
                          onChange={(e) => updateChapter(index, 'title', e.target.value)}
                          onBlur={handleEditEnd}
                          onKeyDown={handleInputKeyDown}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <div className="cell-content">{chapter.title}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="chapter-controls">
            <button onClick={addChapter}>Row add</button>
            <button onClick={copyCurrentTime}>COPY</button>
            <button onClick={sortChapters}>SORT</button>
            <button onClick={deleteMultiple}>
              Row del
            </button>
            <button onClick={jumpToTime}>Jump</button>
            <button onClick={saveChapters}>Save</button>
          </div>
          
          <div className="info">
            Rows: {chapters.length}, Columns: 2
          </div>
        </div>
      </div>
      
      <div className="status-bar">
        <span>{formatTimeDisplay(currentTime)} / {formatTimeDisplay(duration)}</span>
      </div>
    </div>
  )
}

export default App
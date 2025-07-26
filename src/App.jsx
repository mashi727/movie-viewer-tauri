import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { open } from '@tauri-apps/api/dialog'
import { readText, writeText } from '@tauri-apps/api/clipboard'
import { convertFileSrc } from '@tauri-apps/api/tauri'
import './App.css'

// MenuBar コンポーネント
const MenuBar = ({ 
  openVideo, 
  loadChapters, 
  saveChapters, 
  jumpToTime,
  rewind1Second,
  advance1Second,
  platform 
}) => {
  const [openMenu, setOpenMenu] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(null)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const toggleMenu = (menuName) => {
    setOpenMenu(openMenu === menuName ? null : menuName)
  }

  const handleMenuItemClick = (action) => {
    action()
    setOpenMenu(null)
  }

  const getShortcutText = (shortcut) => {
    if (platform === 'macos') {
      return shortcut.replace('Ctrl+', '⌘')
    }
    return shortcut
  }

  return (
    <div className="menu-bar" ref={menuRef}>
      {/* File Menu */}
      <div className="menu-item">
        <button
          className={`menu-button ${openMenu === 'file' ? 'active' : ''}`}
          onClick={() => toggleMenu('file')}
        >
          File
        </button>
        {openMenu === 'file' && (
          <div className="dropdown-menu">
            <div 
              className="menu-option"
              onClick={() => handleMenuItemClick(openVideo)}
            >
              <span>Open Video...</span>
              <span className="shortcut">{getShortcutText('Ctrl+O')}</span>
            </div>
            <div className="menu-separator"></div>
            <div 
              className="menu-option"
              onClick={() => handleMenuItemClick(loadChapters)}
            >
              <span>Load Chapters...</span>
              <span className="shortcut">{getShortcutText('Ctrl+L')}</span>
            </div>
            <div 
              className="menu-option"
              onClick={() => handleMenuItemClick(saveChapters)}
            >
              <span>Save Chapters</span>
              <span className="shortcut">{getShortcutText('Ctrl+S')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Skip Menu */}
      <div className="menu-item">
        <button
          className={`menu-button ${openMenu === 'skip' ? 'active' : ''}`}
          onClick={() => toggleMenu('skip')}
        >
          Skip
        </button>
        {openMenu === 'skip' && (
          <div className="dropdown-menu">
            <div 
              className="menu-option"
              onClick={() => handleMenuItemClick(jumpToTime)}
            >
              <span>Jump to Selected Time</span>
              <span className="shortcut">{getShortcutText('Ctrl+J')}</span>
            </div>
            <div className="menu-separator"></div>
            <div 
              className="menu-option"
              onClick={() => handleMenuItemClick(rewind1Second)}
            >
              <span>1 Second Backward</span>
              <span className="shortcut">{getShortcutText('Ctrl+←')}</span>
            </div>
            <div 
              className="menu-option"
              onClick={() => handleMenuItemClick(advance1Second)}
            >
              <span>1 Second Forward</span>
              <span className="shortcut">{getShortcutText('Ctrl+→')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
const [statusMessage, setStatusMessage] = useState('') // ステータスメッセージ用

const videoRef = useRef(null)
const animationFrameRef = useRef(null)
const tableRef = useRef(null)

// 選択された行をビューにスクロールする関数
const scrollToSelectedRow = (rowIndex) => {
  if (tableRef.current && rowIndex !== null) {
    const row = tableRef.current.querySelector(`tbody tr:nth-child(${rowIndex + 1})`)
    if (row) {
      row.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })
    }
  }
}

// テーブル領域でのマウスホイールスクロールを確実に有効化
useEffect(() => {
  const tableWrapper = tableRef.current
  if (tableWrapper) {
    // フォーカスを設定してスクロールを有効化
    const enableScroll = () => {
      tableWrapper.style.overflow = 'auto'
      tableWrapper.tabIndex = -1 // フォーカス可能にする
    }
    
    enableScroll()
    
    // クリック時にフォーカスを設定
    const handleClick = () => {
      tableWrapper.focus()
    }
    
    tableWrapper.addEventListener('click', handleClick)
    
    return () => {
      tableWrapper.removeEventListener('click', handleClick)
    }
  }
}, [])

// 編集セルが変更された時にテキストを全選択
useEffect(() => {
  if (editingCell) {
    // 次のフレームで実行して、DOMの更新を待つ
    setTimeout(() => {
      const input = document.querySelector('.chapter-table input:focus')
      if (input) {
        input.select()
      }
    }, 0)
  }
}, [editingCell])

// 選択状態が変わったときにスクロール
useEffect(() => {
  if (selectedChapter !== null) {
    scrollToSelectedRow(selectedChapter)
  }
}, [selectedChapter])

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
    // ステータスバーへの表示は削除（タイトル部分に既に表示されているため）
  }
} catch (error) {
  console.error('Error opening video:', error)
  setStatusMessage(`Error opening video: ${error.message}`)
  setTimeout(() => setStatusMessage(''), 5000)
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
    setStatusMessage(`LOADED: ${selected}`)
    setTimeout(() => setStatusMessage(''), 5000)
  }
} catch (error) {
  console.error('Error loading chapters:', error)
  setStatusMessage(`Error loading: ${error.message}`)
  setTimeout(() => setStatusMessage(''), 5000)
}

}

const saveChapters = async () => {
if (!videoPath) {
console.log("No file name set")
setStatusMessage("No video file loaded")
setTimeout(() => setStatusMessage(''), 3000)
return
}

const basePath = videoPath.replace(/\.[^/.]+$/, '')
const savePath = `${basePath}.txt`

try {
await invoke('save_chapters', { 
  filePath: savePath, 
  chapters: chapters 
})

console.log('Chapters saved to:', savePath)
setStatusMessage(`SAVED: ${savePath}`)
setTimeout(() => setStatusMessage(''), 5000) // 5秒後にクリア
} catch (error) {
console.error('Error saving chapters:', error)
setStatusMessage(`Error saving: ${error.message}`)
setTimeout(() => setStatusMessage(''), 5000)
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
  console.log(`Added chapter at position ${selectedChapter + 2}`)
} else {
  setChapters([...chapters, newChapter])
  console.log('Added chapter at end')
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

// 1秒戻る/進む機能
const rewind1Second = () => {
if (videoRef.current) {
const currentTime = videoRef.current.currentTime
const newTime = Math.max(0, currentTime - 1)
videoRef.current.currentTime = newTime
console.log(`Rewound 1 second to ${newTime.toFixed(3)}s`)
}
}

const advance1Second = () => {
if (videoRef.current) {
const currentTime = videoRef.current.currentTime
const duration = videoRef.current.duration || 0
const newTime = Math.min(duration, currentTime + 1)
videoRef.current.currentTime = newTime
console.log(`Advanced 1 second to ${newTime.toFixed(3)}s`)
}
}

// 1フレーム戻る/進む機能（25fps想定）
const rewind1Frame = () => {
if (videoRef.current) {
const currentTime = videoRef.current.currentTime
const frameRate = 25.0 // フレームレート（デフォルト25fps）
const frameDuration = 1 / frameRate
const newTime = Math.max(0, currentTime - frameDuration)
videoRef.current.currentTime = newTime
console.log(`Rewound 1 frame to ${newTime.toFixed(3)}s`)
}
}

const advance1Frame = () => {
if (videoRef.current) {
const currentTime = videoRef.current.currentTime
const duration = videoRef.current.duration || 0
const frameRate = 25.0 // フレームレート（デフォルト25fps）
const frameDuration = 1 / frameRate
const newTime = Math.min(duration, currentTime + frameDuration)
videoRef.current.currentTime = newTime
console.log(`Advanced 1 frame to ${newTime.toFixed(3)}s`)
}
}

// 再生/一時停止機能
const toggleVideoPlayPause = () => {
if (videoRef.current) {
if (videoRef.current.paused) {
videoRef.current.play()
console.log('Video play')
} else {
videoRef.current.pause()
console.log('Video pause')
}
}
}

// 再生状態を取得
const isVideoPlaying = () => {
return videoRef.current && !videoRef.current.paused
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
  
  // 単一選択状態の場合、現在の選択行を複数選択リストに含める
  if (newSelectedRows.length === 0 && selectedChapter !== null) {
    newSelectedRows = [selectedChapter]
  }
  
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
      case 'ArrowLeft':
        e.preventDefault()
        rewind1Second()
        break
      case 'ArrowRight':
        e.preventDefault()
        advance1Second()
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
<MenuBar 
openVideo={openVideo}
loadChapters={loadChapters}
saveChapters={saveChapters}
jumpToTime={jumpToTime}
rewind1Second={rewind1Second}      // この行を追加
advance1Second={advance1Second}    // この行を追加
platform={platform}
/>
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
      
      {/* 動画時間表示領域 */}
      <div className="video-time-display">
        <div className="video-time-controls">
          <button onClick={rewind1Second} disabled={!videoPath}>-1sec</button>
          <button 
            className="frame-button"
            onClick={rewind1Frame} 
            disabled={!videoPath}
          >
            -1f
          </button>
          <button 
            className="play-pause-button"
            onClick={toggleVideoPlayPause} 
            disabled={!videoPath}
          >
            {isVideoPlaying() ? '⏸' : '▶'}
          </button>
          <button 
            className="frame-button"
            onClick={advance1Frame} 
            disabled={!videoPath}
          >
            +1f
          </button>
          <button onClick={advance1Second} disabled={!videoPath}>+1sec</button>
        </div>
        {videoPath ? (
          <span>{formatTimeDisplay(currentTime)} / {formatTimeDisplay(duration)}</span>
        ) : (
          <span>No video loaded</span>
        )}
      </div>
    </div>
    
    <div className="chapter-section">
      <div className="chapter-table">
        <div 
          className="chapter-table-wrapper" 
          ref={tableRef}
          tabIndex={-1}
          style={{ outline: 'none' }}
        >
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
      </div>
      
      <div className="chapter-controls">
        <button onClick={addChapter}>ROW ADD</button>
        <button onClick={copyCurrentTime}>COPY</button>
        <button onClick={sortChapters}>SORT</button>
        <button onClick={deleteMultiple}>
          ROW DEL
        </button>
        <button onClick={jumpToTime}>JUMP</button>
        <button onClick={saveChapters}>SAVE</button>
      </div>
      
      <div className="info">
        Rows: {chapters.length}, Columns: 2
      </div>
    </div>
  </div>
  
  <div 
    className="status-bar"
    style={statusMessage?.startsWith('SAVED:') ? { justifyContent: 'flex-start' } : {}}
  >
    {statusMessage && (
      <span 
        style={statusMessage.startsWith('SAVED:') ? { fontSize: '14pt' } : {}}
      >
        {statusMessage}
      </span>
    )}
  </div>
</div>

)
}

export default App

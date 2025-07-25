// Prevents additional console window on Windows in release, DO NOT REMOVE!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Manager;
use regex::Regex;
use chrono::Duration;

#[derive(Debug, Serialize, Deserialize)]
struct Chapter {
    time: String,
    title: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TimePosition {
    hours: i32,
    minutes: i32,
    seconds: f64,
}

impl TimePosition {
    fn from_milliseconds(ms: i64) -> Self {
        let total_seconds = ms as f64 / 1000.0;
        let hours = (total_seconds / 3600.0) as i32;
        let remainder = total_seconds % 3600.0;
        let minutes = (remainder / 60.0) as i32;
        let seconds = remainder % 60.0;
        
        TimePosition {
            hours,
            minutes,
            seconds,
        }
    }
    
    fn to_milliseconds(&self) -> i64 {
        ((self.hours as f64 * 3600.0 + self.minutes as f64 * 60.0 + self.seconds) * 1000.0) as i64
    }
    
    fn to_string(&self, include_ms: bool) -> String {
        if include_ms {
            format!("{:01}:{:02}:{:06.3}", self.hours, self.minutes, self.seconds)
        } else {
            format!("{:01}:{:02}:{:02}", self.hours, self.minutes, self.seconds as i32)
        }
    }
    
    fn from_string(time_str: &str) -> Option<Self> {
        let re = Regex::new(r"^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$").unwrap();
        
        if let Some(captures) = re.captures(time_str) {
            let hours = captures.get(1)?.as_str().parse().ok()?;
            let minutes = captures.get(2)?.as_str().parse().ok()?;
            let seconds_int: i32 = captures.get(3)?.as_str().parse().ok()?;
            let milliseconds = captures.get(4)
                .map(|m| m.as_str().parse::<i32>().unwrap_or(0))
                .unwrap_or(0);
            
            let seconds = seconds_int as f64 + milliseconds as f64 / 1000.0;
            
            Some(TimePosition {
                hours,
                minutes,
                seconds,
            })
        } else {
            None
        }
    }
}

#[tauri::command]
fn load_chapters(file_path: String) -> Result<Vec<Chapter>, String> {
    match fs::read_to_string(&file_path) {
        Ok(content) => {
            let chapters: Vec<Chapter> = content
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| {
                    let parts: Vec<&str> = line.splitn(2, ' ').collect();
                    Chapter {
                        time: parts.get(0).unwrap_or(&"").to_string(),
                        title: parts.get(1).unwrap_or(&"").to_string(),
                    }
                })
                .collect();
            Ok(chapters)
        }
        Err(e) => Err(format!("Failed to load file: {}", e)),
    }
}

#[tauri::command]
fn save_chapters(file_path: String, chapters: Vec<Chapter>) -> Result<(), String> {
    let content = chapters
        .iter()
        .map(|ch| format!("{} {}", ch.time, ch.title))
        .collect::<Vec<String>>()
        .join("\n");
    
    match fs::write(&file_path, content) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to save file: {}", e)),
    }
}

#[tauri::command]
fn parse_youtube_chapters(text: String) -> Vec<Chapter> {
    let mut chapters = Vec::new();
    
    // 時間パターンの正規表現
    let time_pattern = Regex::new(r"(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{1,2}:\d{2}\.\d{3}|\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})").unwrap();
    
    // 改行で分割
    let lines: Vec<&str> = text.split('\n').collect();
    
    // 1行のみの場合の処理
    if lines.len() == 1 && !lines[0].is_empty() {
        let line = lines[0];
        let matches: Vec<_> = time_pattern.find_iter(line).collect();
        
        if matches.len() > 1 {
            for (i, mat) in matches.iter().enumerate() {
                let time_str = mat.as_str();
                
                let title = if i + 1 < matches.len() {
                    line[mat.end()..matches[i + 1].start()].trim()
                } else {
                    line[mat.end()..].trim()
                };
                
                let title = title.trim_start_matches(&['-', ' '][..]);
                
                if !title.is_empty() {
                    chapters.push(Chapter {
                        time: normalize_time(time_str),
                        title: title.to_string(),
                    });
                }
            }
        }
    } else {
        // 通常の改行区切りの処理
        for line in lines {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            
            if let Some(mat) = time_pattern.find(line) {
                let time_str = mat.as_str();
                let title = line[mat.end()..].trim().trim_start_matches(&['-', ' '][..]);
                
                if !title.is_empty() {
                    chapters.push(Chapter {
                        time: normalize_time(time_str),
                        title: title.to_string(),
                    });
                }
            }
        }
    }
    
    chapters
}

fn normalize_time(time_str: &str) -> String {
    let parts: Vec<&str> = time_str.split('.').collect();
    let time_part = parts[0];
    let ms_part = parts.get(1).unwrap_or(&"000");
    
    let time_components: Vec<&str> = time_part.split(':').collect();
    
    let (hours, minutes, seconds) = match time_components.len() {
        2 => (0, time_components[0].parse::<i32>().unwrap_or(0), time_components[1].parse::<i32>().unwrap_or(0)),
        3 => (
            time_components[0].parse::<i32>().unwrap_or(0),
            time_components[1].parse::<i32>().unwrap_or(0),
            time_components[2].parse::<i32>().unwrap_or(0),
        ),
        _ => return time_str.to_string(),
    };
    
    let ms_padded = format!("{:0<3}", &ms_part[..ms_part.len().min(3)]);
    
    format!("{}:{:02}:{:02}.{}", hours, minutes, seconds, ms_padded)
}

#[tauri::command]
fn get_platform() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    
    #[cfg(target_os = "macos")]
    return "macos".to_string();
    
    #[cfg(target_os = "linux")]
    return "linux".to_string();
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return "unknown".to_string();
}

#[tauri::command]
async fn format_time(milliseconds: f64) -> Result<String, String> {
    let time_pos = TimePosition::from_milliseconds(milliseconds as i64);
    Ok(time_pos.to_string(true))
}

#[tauri::command]
async fn parse_time(time_str: String) -> Result<Option<f64>, String> {
    Ok(TimePosition::from_string(&time_str).map(|tp| tp.to_milliseconds() as f64))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_chapters,
            save_chapters,
            parse_youtube_chapters,
            get_platform,
            format_time,
            parse_time
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

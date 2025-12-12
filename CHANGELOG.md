# Changelog

All notable changes to Satorama will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-12
### Added
- Interactive onboarding walkthrough for first-time users
- 9-step guided tour with spotlight highlighting
- Help button (bottom-left) to restart tutorial anytime
- Keyboard navigation for walkthrough (arrows, Enter, Escape)
- localStorage persistence for "seen" state

## [1.0.0] - 2025-12-08
### Added
- 3D Earth visualization with realistic textures
- Real-time satellite orbit propagation using SGP4/SDP4
- Support for 25,000+ satellites via InstancedMesh rendering
- TLE preset loading (ISS, GPS, Starlink, Weather, etc.)
- Custom TLE input modal
- Synthetic satellite density slider
- Ground station markers (Kennedy, Baikonur, Kourou, Tanegashima)
- Satellite search with filtering by type
- Object Analysis panel with orbital parameters
- TLE health indicator (epoch age)
- Time control (play/pause, speed 1x to 1000x, reverse)
- Orbit class filtering (LEO/MEO/GEO/HEO)
- Camera tracking and follow mode
- Satellite trails and ground tracks
- Line of sight visualization
- Hover tooltips with satellite info
- Responsive design for tablet/mobile
- Portrait orientation warning
- Toast notifications

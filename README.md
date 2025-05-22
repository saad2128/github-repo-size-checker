# GitHub Repository Size Checker 📦

This Google Apps Script project provides a spreadsheet-based tool to analyze GitHub repositories for size constraints. It helps determine whether a repository’s codebase fits within a 100K-character context window — ideal for tools involving AI model context limitations.

## ✨ Features
- Adds a custom "GitHub Tools" menu in Google Sheets.
- Extracts repository metadata (stars, forks, language, description).
- Recursively fetches and analyzes code files.
- Calculates:
  - Total characters
  - Total lines of code
  - Whether the repository fits within a 100K-character limit
- Highlights oversized repositories with conditional formatting.

## 🛠️ How to Use
1. Open your Google Sheet.
2. Paste a GitHub repository URL in a cell.
3. From the "GitHub Tools" menu, select **Check Active Repository**.
4. The tool will analyze the repository and populate results in adjacent columns.

## 📌 Limitations
- Maximum 1,000 files analyzed per repository.
- Skips large files (>500KB), non-code files, and common directories like `node_modules`, `dist`, `test`, etc.
- Requires internet access and is subject to GitHub API rate limits.

## 📁 Example Columns
| Repository URL | Repository | Stars | Forks | Description | Language | Total Characters | Total Lines of Code | Meets Requirement | Comment |
|----------------|------------|-------|-------|-------------|----------|------------------|----------------------|-------------------|---------|

## 🚧 Future Improvements
- OAuth support to avoid GitHub rate limits.
- Better language-based filtering.
- Support for organization-wide analysis.


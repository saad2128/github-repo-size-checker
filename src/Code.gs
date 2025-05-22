/**
 * GitHub Repository Size Checker
 * 
 * This script checks if a GitHub repository meets the size requirements for a project.
 * It analyzes the currently active cell for a GitHub URL, calculates the total character count
 * and lines of code of all code files, and determines if it fits within a 100K context window.
 */

// Create a custom menu when the spreadsheet opens
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('GitHub Tools')
    .addItem('Check Active Repository', 'checkActiveRepositorySize')
    .addToUi();
}

/**
 * Main function to check the size of the GitHub repository in the active cell
 */
function checkActiveRepositorySize() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const activeCell = sheet.getActiveCell();
  const activeCellValue = activeCell.getValue();

  // Check if the active cell contains a GitHub URL
  if (!isGitHubUrl(activeCellValue)) {
    SpreadsheetApp.getUi().alert('The active cell does not contain a valid GitHub repository URL');
    return;
  }

  const row = activeCell.getRow();
  const repoUrl = activeCellValue;

  try {
    const { owner, repo } = parseGitHubUrl(repoUrl);
    const repoData = fetchRepositoryData(owner, repo);

    const maxFilesToProcess = 1000;
    const { totalChars, totalLines, stoppedEarly } = calculateTotalCodeSize(owner, repo, maxFilesToProcess);

    const meetsRequirement = !stoppedEarly && totalChars <= 100000;
    updateResults(sheet, row, repoData, totalChars, totalLines, meetsRequirement, stoppedEarly);

    SpreadsheetApp.getUi().alert(
      `Repository analysis complete!\n\nTotal characters: ${totalChars.toLocaleString()}\n` +
      `Total lines of code: ${totalLines.toLocaleString()}\n` +
      `Meets requirement: ${meetsRequirement ? 'Yes' : 'No'}${stoppedEarly ? '\n\nNote: Stopped early due to size or file count limit.' : ''}`
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert(`Error: ${error.message}`);
  }
}

/**
 * Calculate the total size of code files in the repository
 */
function calculateTotalCodeSize(owner, repo, maxFilesToProcess = 1000) {
  const contents = fetchRepositoryContents(owner, repo, '');
  const result = processContents(owner, repo, contents, { count: 0 }, maxFilesToProcess);
  return {
    totalChars: result.totalChars,
    totalLines: result.totalLines,
    stoppedEarly: result.stoppedEarly
  };
}

/**
 * Process repository contents and calculate total character count and lines of code
 */
function processContents(owner, repo, contents, counter, maxFilesToProcess) {
  let totalChars = 0;
  let totalLines = 0;
  let stoppedEarly = false;

  if (!Array.isArray(contents)) contents = [contents];

  for (const item of contents) {
    if (shouldSkipFile(item)) continue;

    if (item.type === 'file') {
      if (++counter.count > maxFilesToProcess) {
        stoppedEarly = true;
        break;
      }

      if (item.size > 500000) continue;
      if (!isCodeFile(item.name)) continue;

      try {
        const content = fetchFileContent(item.download_url);
        totalChars += content.length;
        totalLines += content.split('\n').filter(line => line.trim().length > 0).length;
      } catch (err) {
        console.log(`Error processing file ${item.path}: ${err.message}`);
      }

    } else if (item.type === 'dir') {
      const subdirContents = fetchRepositoryContents(owner, repo, item.path);
      const subResult = processContents(owner, repo, subdirContents, counter, maxFilesToProcess);
      totalChars += subResult.totalChars;
      totalLines += subResult.totalLines;
      if (subResult.stoppedEarly) {
        stoppedEarly = true;
        break;
      }
    }
  }

  return { totalChars, totalLines, stoppedEarly };
}

/**
 * Update the spreadsheet with results
 */
function updateResults(sheet, row, repoData, totalChars, totalLines, meetsRequirement, stoppedEarly) {
  const headers = [
    'Repository URL', 'Repository', 'Stars', 'Forks',
    'Description', 'Language', 'Total Characters',
    'Total Lines of Code', 'Meets Requirement', 'Comment'
  ];

  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (existingHeaders[0] === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  const comment = stoppedEarly ? 'Stopped early due to size or file count limit.' : '';

  const resultData = [[
    repoData.html_url,
    repoData.name,
    repoData.stargazers_count,
    repoData.forks_count,
    repoData.description || '',
    repoData.language || 'Unknown',
    totalChars,
    totalLines,
    meetsRequirement ? 'Yes' : 'No',
    comment
  ]];

  sheet.getRange(row, 3, 1, resultData[0].length).setValues(resultData);
  sheet.getRange(row, 11).setBackground(meetsRequirement ? '#d9ead3' : '#f4cccc');
  sheet.getRange(row, 8).setNumberFormat('#,##0');
  sheet.getRange(row, 9).setNumberFormat('#,##0');
}

/**
 * Check if a string is a valid GitHub repository URL
 */
function isGitHubUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/.test(url);
}

/**
 * Parse GitHub URL to extract owner and repository name
 */
function parseGitHubUrl(url) {
  url = url.replace(/\/$/, ''); // Remove trailing slash if present
  const parts = url.split('/');
  const owner = parts[parts.length - 2];
  const repo = parts[parts.length - 1];
  return { owner, repo };
}

/**
 * Fetch repository data using GitHub API
 */
function fetchRepositoryData(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const response = UrlFetchApp.fetch(url, { 
    muteHttpExceptions: true,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Google Apps Script'
    }
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Failed to fetch repository data. Status code: ${response.getResponseCode()}`);
  }

  return JSON.parse(response.getContentText());
}

/**
 * Fetch repository contents for a given path
 */
function fetchRepositoryContents(owner, repo, path) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Google Apps Script'
    }
  });

  if (response.getResponseCode() !== 200) {
    console.log(`Failed to fetch contents for path: ${path}. Status: ${response.getResponseCode()}`);
    return [];
  }

  return JSON.parse(response.getContentText());
}

/**
 * Check if a file should be skipped
 */
function shouldSkipFile(item) {
  const pathsToSkip = [
    'node_modules', '.git', 'dist', 'build', 'vendor',
    '.github', 'examples', 'docs', 'test', 'tests'
  ];

  return pathsToSkip.some(path => item.path.includes(path));
}

/**
 * Check if a file is a code file (based on extension)
 */
function isCodeFile(filename) {
  const codeExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs',
    '.php', '.rb', '.go', '.swift', '.kt', '.rs', '.dart', '.html', '.css', 
    '.scss', '.less', '.json', '.yml', '.yaml', '.xml', '.sh', '.md'
  ];

  return codeExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

/**
 * Fetch file content from a URL
 */
function fetchFileContent(url) {
  try {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Google Apps Script'
      }
    });

    if (response.getResponseCode() !== 200) {
      console.log(`Failed to fetch file content. Status: ${response.getResponseCode()}`);
      return '';
    }

    return response.getContentText();
  } catch (error) {
    console.log(`Error fetching file content: ${error.message}`);
    return '';
  }
}

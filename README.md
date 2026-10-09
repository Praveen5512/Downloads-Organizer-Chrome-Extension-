# Downloads Organizer (Chrome Extension)

A lightweight, privacy-first **Manifest V3** Chrome extension that automatically organizes your downloaded files into custom folders using flexible rules, regular expressions, domain filters, file extensions, and dynamic date/hostname placeholders.

---

## ✨ Features

- **Rule-Based Routing**: Route incoming downloads into organized subdirectories based on custom criteria.
- **Mandatory Path & Optional Filters**:
  - **Download Path** (*Mandatory*): Subdirectory relative to your default `Downloads/` directory.
  - **Domain** (*Optional*): Route downloads from specific websites (e.g. `github.com` or `*.google.com`).
  - **File Type** (*Optional*): Match specific file extensions (e.g. `pdf, docx, png`).
  - **Filename Regex** (*Optional*): Match patterns in the filename (e.g. `^invoice_\d+.*`).
- **Dynamic Path Placeholders**: Automatically inject context variables into your folder names:
  - `{hostname}` – Origin/referrer website domain (e.g., `github.com`).
  - `{ext}` – File extension without dot (e.g., `pdf`).
  - `{basename}` – File name without extension.
  - `{filename}` – Original full file name.
  - `{year}` – 4-digit current year (e.g., `2026`).
  - `{month}` – 2-digit current month (`01`–`12`).
  - `{day}` – 2-digit current day (`01`–`31`).
  - `{date}` – Current ISO date (`YYYY-MM-DD`).
- **Priority Order Matching**:
  - Rules are evaluated from **top to bottom**. The first matching rule determines the download destination.
  - Reorder rules effortlessly using Move Up / Move Down controls.
- **Default Fallback**: Downloads that do not match any active rule are saved directly to your default `Downloads/` folder without any extra subfolder.
- **Interactive Rule Sandbox / Tester**: Simulate download URLs and filenames in real-time to preview which rule matches and see the exact destination path before downloading real files.
- **Backup & Restore**: Export all your configured rules as JSON or import existing rules across devices.
- **Path Sanitization**: Automatically handles invalid file characters (`: * ? " < > |`) and prevents directory traversal (`..`) for cross-platform compatibility.

---

## 🚀 Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/group-download-files-by-hostname.git
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the folder containing `manifest.json`.
6. Pin the extension icon to your browser toolbar for quick access!

---

## 🛠️ Usage & Rule Configuration

Click the extension icon in the toolbar and select **Manage All Rules & Tester**, or right-click the extension icon and select **Options**.

### Example Rules

| Rule Name | Domain | File Type | Filename Regex | Download Path | Resulting Destination |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Invoices** | *(any)* | `pdf` | `(invoice\|receipt\|statement)` | `Invoices/{year}` | `Downloads/Invoices/2026/invoice_01.pdf` |
| **GitHub Archives** | `github.com` | `zip, tar, gz` | *(any)* | `Code/GitHub` | `Downloads/Code/GitHub/repo.zip` |
| **Web Images** | *(any)* | `jpg, png, webp, svg` | *(any)* | `Images/{hostname}` | `Downloads/Images/unsplash.com/photo.jpg` |
| **Office Documents** | *(any)* | `docx, xlsx, pptx` | *(any)* | `Documents/{ext}/{year}` | `Downloads/Documents/xlsx/2026/data.xlsx` |

---

## 🧩 Supported Path Placeholders

When defining your **Download Path**, you can use the following variables:

| Placeholder | Description | Example Output |
| :--- | :--- | :--- |
| `{hostname}` | Website domain of origin/referrer | `github.com` |
| `{ext}` | File extension | `pdf` |
| `{basename}` | File name without extension | `report` |
| `{filename}` | Complete original file name | `report.pdf` |
| `{year}` | 4-digit current year | `2026` |
| `{month}` | 2-digit current month | `10` |
| `{day}` | 2-digit current day | `09` |
| `{date}` | ISO date (`YYYY-MM-DD`) | `2026-10-09` |
| `{time}` | Timestamp (`HH-MM-SS`) | `14-30-00` |

> [!NOTE]
> Chrome extensions can only save files within your designated browser Downloads directory. Path separators (`/`) create nested subdirectories. Leading slashes and directory traversal (`../`) are automatically sanitized.

---

## 📁 Project Structure

```
├── manifest.json       # Manifest V3 extension configuration
├── bg.js               # Service worker handling chrome.downloads API events
├── rules-engine.js     # Shared matching engine, token interpolation, and sanitization
├── options.html        # Options page layout (Rules manager, tester, backup)
├── options.css         # Options page modern styling (Dark theme & glassmorphism)
├── options.js          # Options page controller and state management
├── popup.html          # Toolbar popup UI
├── popup.css           # Toolbar popup styles
├── popup.js            # Toolbar popup controller
├── icons/              # Extension icons (16px, 48px, 128px)
├── LICENSE             # MIT License
└── README.md           # Documentation
```

---

## 🔒 Privacy & Permissions

- **`downloads`**: Required to inspect incoming downloads and suggest subdirectories via `chrome.downloads.onDeterminingFilename`.
- **`storage`**: Used solely to store your custom rules and preferences locally via `chrome.storage.sync` / `chrome.storage.local`.
- **Zero Tracking**: 100% offline and client-side. No telemetry, analytics, or external server requests.

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).

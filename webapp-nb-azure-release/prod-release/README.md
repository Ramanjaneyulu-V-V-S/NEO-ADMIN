# 🌾 NABARD Modern UI

A feature-rich, enterprise-grade frontend application for NABARD (National Bank for Agriculture and Rural Development), developed and maintained by [Sedin Technologies Pvt. Ltd.](https://sedintechnologies.com/). Built with **React 19**, **Vite**, **Redux Toolkit**, and **KendoReact**, the app provides a scalable, maintainable, and modern user interface for critical NABARD systems.

🔗 **Repository**: [GitHub](https://github.com/SedinTechnologiesPvtLtd/nabard-modern-ui.git)

## 🚧 Project Structure

```bash
nabard-modern-ui/
├── public/               # Static files
├── src/
│   ├── assets/           # Images, fonts, Lottie files
│   ├── components/       # Reusable UI components
│   ├── Hooks/            # Custom Hooks
│   ├── iframe/           # IV
│   ├── pages/            # Route-level components
│   ├── Redux/            # Redux Store
│   ├── services/         # API calls using axios
│   └── utils/            # Helper functions, formatters, etc.
├── .eslintrc.js          # ESLint config
├── vite.config.js        # Vite configuration
├── package.json          # Project metadata and dependencies
└── README.md             # Project documentation
```

## 🚧 Branch Strategy

| Branch Name          | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `production-release` | Stable PRODUCTION code                      |
| `uat-release`        | Stable code deployed to UAT                 |
| `dev-bug-fixing`     | Bug fixes and changes for AZURE environment |

---

## ⚙️ Tech Stack

- **Frontend Framework**: [React 19](https://react.dev/)
- **Bundler**: [Vite 6](https://vitejs.dev/)
- **State Management**: [Redux Toolkit](https://redux-toolkit.js.org/)
- **UI Library**: [KendoReact](https://www.telerik.com/kendo-react-ui)
- **Styling**: Bootstrap 5, Kendo Theme Default, Styled Components
- **Charts**: Kendo Charts, Chart.js, react-chartjs-2
- **Routing**: React Router DOM v7
- **APIs**: Axios, qs, react-hook-form
- **Other Tools**:
  - SweetAlert2 & React-Toastify for notifications
  - Moment.js for date manipulation
  - Lottie for animations

---

## 📦 Installation

Clone and set up the project locally:

```bash
# Clone the repo
git clone https://github.com/SedinTechnologiesPvtLtd/nabard-modern-ui.git
cd nabard-modern-ui

# Switch to the development branch
git checkout dev-bug-fixing

# Install dependencies
npm install
```

## 🚀 Running the Project

Use the following commands based on your scenario:

| Scenario             | Command            | Mode?         | When to Use                            |
| -------------------- | ------------------ | ------------- | -------------------------------------- |
| Development          | `npm run dev`      | `development` | While coding and testing locally       |
| Production Build     | `npm run build`    | `production`  | When you're ready to deploy or preview |
| Preview Build Output | `npx vite preview` | `production`  | To test build locally before deploying |

### 📝 Explanation:

- **`npm run dev`** – Starts the development server with hot-reloading for real-time changes while coding.
- **`npm run build`** – Creates an optimized production build in the `/dist` folder.
- **`npx vite preview`** – Serves the build locally to simulate production before actually deploying it to a server.

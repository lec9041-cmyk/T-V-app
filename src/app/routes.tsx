import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Home } from "./components/Home";
import { Study } from "./components/Study";
import { Stats } from "./components/Stats";
import { Settings } from "./components/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "study", Component: Study },
      { path: "stats", Component: Stats },
      { path: "settings", Component: Settings },
    ],
  },
]);

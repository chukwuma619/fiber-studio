import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="m-0 flex flex-col justify-center pt-[10vh] text-center">
      <h1>Welcome to Tauri + React</h1>

      <div className="flex justify-center">
        <a href="https://vite.dev" target="_blank">
          <img
            src="/vite.svg"
            className="h-24 p-6 transition duration-750 will-change-[filter] hover:drop-shadow-[0_0_2em_#747bff]"
            alt="Vite logo"
          />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img
            src="/tauri.svg"
            className="h-24 p-6 transition duration-750 will-change-[filter] hover:drop-shadow-[0_0_2em_#24c8db]"
            alt="Tauri logo"
          />
        </a>
        <a href="https://react.dev" target="_blank">
          <img
            src={reactLogo}
            className="h-24 p-6 transition duration-750 will-change-[filter] hover:drop-shadow-[0_0_2em_#61dafb]"
            alt="React logo"
          />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="flex justify-center"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          className="mr-1.5 rounded-lg border border-transparent bg-white px-5 py-2.5 text-base font-medium text-neutral-950 shadow-sm outline-none transition-colors focus:border-blue-600 dark:bg-neutral-950/60 dark:text-white"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button
          type="submit"
          className="cursor-pointer rounded-lg border border-transparent bg-white px-5 py-2.5 text-base font-medium text-neutral-950 shadow-sm outline-none transition-colors hover:border-blue-600 active:border-blue-600 active:bg-neutral-200 dark:bg-neutral-950/60 dark:text-white dark:active:bg-neutral-950/40"
        >
          Greet
        </button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;

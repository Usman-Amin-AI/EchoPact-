"use client"
import {ConvAI} from "../components/ConvAI";
export default function Home() {
    return (
        <div
            className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
            <main className="flex flex-col md:flex-row gap-8 row-start-2 items-center">
                <ConvAI/>
            </main>
        </div>
    );
}

                //<ConvAI/>
                //<AudioMessenger/>

                // https://d4c44f081440.ngrok.app/
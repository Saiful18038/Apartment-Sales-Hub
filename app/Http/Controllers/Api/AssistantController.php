<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiAssistantService;
use Illuminate\Http\Request;

class AssistantController extends Controller
{
    public function __construct(protected AiAssistantService $assistant) {}

    /** Any authenticated role may ask — the answer is scoped to what they can already see (see AiAssistantService). */
    public function chat(Request $request)
    {
        $data = $request->validate([
            'message' => 'required|string|max:2000',
        ]);

        $reply = $this->assistant->ask($request->user(), $data['message']);

        return response()->json([
            'reply' => $reply,
            'configured' => $this->assistant->isConfigured(),
        ]);
    }

    /** Lets the frontend show a setup notice without needing to send a message first. */
    public function status(Request $request)
    {
        return response()->json(['configured' => $this->assistant->isConfigured()]);
    }
}

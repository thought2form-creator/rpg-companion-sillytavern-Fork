/**
 * Text Generation Module
 * Handles sending pre-assembled string prompts to SillyTavern's generation system
 *
 * This module provides a clean interface for text generation using ConnectionManagerRequestService.
 * It accepts a pre-assembled string prompt and wraps it in the required message array format.
 */

import { generateRaw } from '../../../../../../../../script.js';

// Note: getContext is passed as a parameter to avoid import path issues

/**
 * EXPERIMENTAL: Use generateRaw for macro processing
 * Set to true to use generateRaw (processes ST macros like {{char}}, {{user}})
 * Set to false to use ConnectionManagerRequestService (default)
 *
 * NOTE: generateRaw DOES support max_length parameter for controlling output length.
 */
const USE_GENERATE_RAW = true;

/**
 * Send a text generation request to SillyTavern using ConnectionManagerRequestService
 *
 * @param {string} prompt - Pre-assembled prompt string (will be wrapped in a message array)
 * @param {Object} options - Generation options
 * @param {Object} options.context - SillyTavern context object (from getContext())
 * @param {string} [options.profileId] - Connection profile ID (if not provided, uses active profile)
 * @param {number} [options.maxTokens=2048] - Maximum tokens to generate
 * @param {'user'|'system'} [options.role='user'] - Message role for the prompt
 * @param {AbortSignal} [options.signal] - Abort signal for cancellation
 * @returns {Promise<string>} Generated text response
 * @throws {Error} If generation fails or returns empty response
 *
 * @example
 * const context = getContext();
 * const prompt = "You are a helpful assistant.\n\nUser: Hello!\nAssistant:";
 * const response = await sendTextGeneration(prompt, {
 *     context,
 *     profileId: 'my-profile-id',
 *     maxTokens: 500,
 *     role: 'user'
 * });
 *
 * @note Prompt Assembly Considerations:
 * - The prompt parameter should be a fully assembled string
 * - Include any necessary formatting, separators, or structure
 * - The prompt will be wrapped in a single message with the specified role
 * - For text completion, use 'user' role (default)
 * - For system instructions, use 'system' role
 *
 * @note Future Prompt Builder Integration:
 * - This function will be called by the prompt builder after assembly
 * - Prompt builder should handle:
 *   * Template compilation (Handlebars or similar)
 *   * Section ordering and priority
 *   * Placeholder substitution ({{user}}, {{char}}, etc.)
 *   * Context injection (chat history, character cards, etc.)
 *   * Format-specific assembly (markdown, XML, JSON, etc.)
 * - Max tokens may need to be calculated based on context size
 * - Profile ID should come from extension settings
 *
 * @note Connection Manager Details:
 * - Uses ConnectionManagerRequestService.sendRequest()
 * - Requires a valid connection profile (configured in ST settings)
 * - Temperature/sampling controlled by the profile's preset settings
 * - Stop sequences controlled by the profile's preset settings
 * - Returns response.content (string) or response (if already string)
 */
export async function sendTextGeneration(prompt, options = {}) {
    // Extract options
    const {
        context,
        profileId,
        maxTokens = 2048,
        role = 'user',
        signal
    } = options;

    // Validate context
    if (!context) {
        throw new Error('Context object is required. Pass getContext() as options.context');
    }

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
        throw new Error('Prompt must be a non-empty string');
    }

    // EXPERIMENTAL: Use generateRaw for macro processing
    if (USE_GENERATE_RAW) {
        return sendTextGenerationWithGenerateRaw(prompt, options);
    }

    // Check if Connection Manager is available
    if (!context.ConnectionManagerRequestService || !context.ConnectionManagerRequestService.sendRequest) {
        throw new Error('Connection Manager is not available. Please ensure SillyTavern is properly configured.');
    }

    // Determine which profile to use
    let targetProfileId = profileId;

    if (!targetProfileId) {
        // Try to find active profile
        const profiles = context.extensionSettings?.connectionManager?.profiles || [];
        const activeProfile = profiles.find(p => p.isActive);

        if (!activeProfile) {
            throw new Error('No connection profile specified and no active profile found. Please configure a connection profile in SillyTavern settings.');
        }

        targetProfileId = activeProfile.id;
        console.log('[TextGeneration] Using active profile:', activeProfile.name);
    } else {
        // Verify the specified profile exists
        const profiles = context.extensionSettings?.connectionManager?.profiles || [];
        const profile = profiles.find(p => p.id === targetProfileId);

        if (!profile) {
            throw new Error(`Connection profile with ID "${targetProfileId}" not found.`);
        }

        console.log('[TextGeneration] Using specified profile:', profile.name);
    }

    // Wrap the prompt string in a message array
    // ConnectionManagerRequestService.sendRequest() requires message array format
    const messages = [
        {
            role: role,
            content: prompt
        }
    ];

    console.log('[TextGeneration] Sending generation request:', {
        profileId: targetProfileId,
        promptLength: prompt.length,
        maxTokens: maxTokens,
        role: role,
        messageCount: messages.length
    });

    try {
        // Call Connection Manager
        // Note: AbortSignal support depends on the Connection Manager implementation
        // Currently not directly supported in the sendRequest API
        if (signal) {
            console.warn('[TextGeneration] AbortSignal provided but may not be fully supported by ConnectionManagerRequestService');
        }

        const response = await context.ConnectionManagerRequestService.sendRequest(
            targetProfileId,
            messages,
            maxTokens
        );

        // Extract content from response
        // Response can be either a string or an object with .content property
        let content;
        if (typeof response === 'string') {
            content = response;
        } else if (response && response.content) {
            content = response.content;
        } else {
            throw new Error('Invalid response format from Connection Manager');
        }

        // Validate response
        if (!content || typeof content !== 'string') {
            throw new Error('Generation returned empty or invalid response');
        }

        console.log('[TextGeneration] Generation successful:', {
            responseLength: content.length
        });

        return content;

    } catch (error) {
        console.error('[TextGeneration] Generation failed:', error);
        throw new Error(`Text generation failed: ${error.message}`);
    }
}

/**
 * NOTE: Prompt Builder Integration Points
 *
 * When building the prompt builder, consider these integration points:
 *
 * 1. PROFILE SELECTION:
 *    - Profile ID should come from extension settings
 *    - Allow users to configure which profile to use for generation
 *    - Fall back to active profile if not specified
 *    - Validate profile exists before attempting generation
 *
 * 2. MAX TOKENS:
 *    - Should account for prompt length vs context window
 *    - May need different values for different sections/features
 *    - Consider leaving headroom for context injection
 *    - Default is 2048 but should be configurable
 *
 * 3. MESSAGE ROLE:
 *    - 'user' role for most text completion scenarios (default)
 *    - 'system' role for system instructions/context
 *    - Consider if multiple messages are needed (future enhancement)
 *
 * 4. STOP SEQUENCES & TEMPERATURE:
 *    - These are controlled by the Connection Profile's preset settings
 *    - Cannot be overridden per-request with ConnectionManagerRequestService
 *    - Users must configure these in their ST preset if needed
 *    - Document this limitation for users
 *
 * 5. PROMPT STRUCTURE:
 *    - Consider using clear section delimiters
 *    - Include format examples if needed
 *    - Add explicit instructions for output format
 *    - The entire prompt goes in a single message content
 *
 * 6. FUTURE ENHANCEMENTS:
 *    - Support for multi-message prompts (system + user messages)
 *    - Streaming support (if ConnectionManagerRequestService adds it)
 *    - Better abort/cancellation handling
 *    - Retry logic for failed requests
 */

/**
 * EXPERIMENTAL: Send text generation using generateRaw
 * This method processes SillyTavern macros like {{char}}, {{user}}, etc.
 *
 * generateRaw supports responseLength parameter for controlling output length.
 *
 * @param {string} prompt - Pre-assembled prompt string
 * @param {Object} options - Generation options
 * @param {Object} options.context - SillyTavern context object
 * @param {number} options.maxTokens - Max tokens to generate
 * @returns {Promise<string>} Generated text response
 */
async function sendTextGenerationWithGenerateRaw(prompt, options = {}) {
    const {
        context,
        maxTokens = 2048
    } = options;

    console.log('[TextGeneration] Using generateRaw method (macro processing enabled)');
    console.log('[TextGeneration] Max tokens:', maxTokens);
    console.log('[TextGeneration] Prompt before macro substitution:', {
        length: prompt.length,
        preview: prompt.substring(0, 200)
    });

    // Process SillyTavern macros ({{char}}, {{user}}, etc.)
    const processedPrompt = context.substituteParams(prompt);

    console.log('[TextGeneration] Prompt after macro substitution:', {
        length: processedPrompt.length,
        preview: processedPrompt.substring(0, 200)
    });

    try {
        // Call generateRaw with the processed prompt and responseLength parameter
        const response = await generateRaw({
            prompt: processedPrompt,
            quietToLoud: false,
            responseLength: maxTokens  // Use responseLength parameter (as used by Character Creator)
        });

        // Validate response
        if (!response || typeof response !== 'string') {
            throw new Error('Generation returned empty or invalid response');
        }

        console.log('[TextGeneration] Generation successful (generateRaw):', {
            responseLength: response.length,
            requestedMaxTokens: maxTokens
        });

        return response;

    } catch (error) {
        console.error('[TextGeneration] Generation failed (generateRaw):', error);
        throw new Error(`Text generation failed: ${error.message}`);
    }
}


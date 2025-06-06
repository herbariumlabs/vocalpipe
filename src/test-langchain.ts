import { OpenAIService } from './services/openai';
import { config, validateConfig } from './config';

async function testLangChainIntegration() {
    try {
        // Validate configuration
        validateConfig();
        
        console.log('🧪 Testing LangChain Integration with GPT-4o-mini...');
        console.log('🎯 Goal: Verify exclamation marks are avoided for TTS compatibility\n');
        
        const openaiService = new OpenAIService();
        
        // Test prompts that would typically generate exclamation marks
        const testPrompts = [
            "Tell me something exciting about space exploration",
            "What's amazing about artificial intelligence",
            "Give me an enthusiastic greeting",
            "Tell me why learning is wonderful",
            "Express excitement about new technology"
        ];
        
        console.log('📝 Testing prompts that typically generate exclamation marks:\n');
        
        for (let i = 0; i < testPrompts.length; i++) {
            const prompt = testPrompts[i];
            console.log(`${i + 1}. Prompt: "${prompt}"`);
            
            try {
                const response = await openaiService.generateResponse(prompt);
                console.log(`   Response: "${response}"`);
                
                // Check for exclamation marks
                const hasExclamationMarks = response.includes('!');
                if (hasExclamationMarks) {
                    console.log('   ❌ FAILED: Response contains exclamation marks');
                } else {
                    console.log('   ✅ PASSED: No exclamation marks found');
                }
                console.log('');
                
            } catch (error) {
                console.error(`   ❌ ERROR: ${error}`);
                console.log('');
            }
        }
        
        console.log('🎉 LangChain integration test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testLangChainIntegration()
        .then(() => {
            console.log('✅ All tests completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Test suite failed:', error);
            process.exit(1);
        });
}

export { testLangChainIntegration };

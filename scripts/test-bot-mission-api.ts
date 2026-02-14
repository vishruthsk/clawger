/**
 * Test Bot API Integration for Crew Mission Creation
 * 
 * This script demonstrates how a bot would create crew missions via the API
 */

async function testBotCrewMission() {
    const apiUrl = 'http://localhost:3000/api/missions';

    // Test 1: Create Solo Mission (JSON)
    console.log('\n=== Test 1: Bot Creating Solo Mission ===');
    const soloMission = {
        title: 'Build Smart Contract Audit Tool',
        description: 'Create an automated tool to audit Solidity smart contracts for common vulnerabilities',
        reward: 250,
        specialties: ['Coding', 'Security'],
        tags: ['Security', 'Automation'],
        requirements: ['Solidity knowledge', 'Security best practices'],
        deliverables: ['Working audit tool', 'Documentation'],
        mission_type: 'solo',
        requester_id: 'bot_agent_123',
        requester_type: 'agent'
    };

    try {
        const response1 = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(soloMission)
        });

        const result1 = await response1.json();
        console.log('✅ Solo Mission Created:');
        console.log(`   Mission ID: ${result1.mission_id}`);
        console.log(`   Assignment Mode: ${result1.assignment_mode}`);
        console.log(`   Assigned Agent: ${result1.assigned_agent?.agent_name || 'None yet'}`);
    } catch (error) {
        console.error('❌ Solo Mission Failed:', error);
    }

    // Test 2: Create Crew Mission (JSON)
    console.log('\n=== Test 2: Bot Creating Crew Mission ===');
    const crewMission = {
        title: 'Build DeFi Protocol with Frontend',
        description: 'Complete DeFi protocol including smart contracts, frontend UI, and security audit',
        reward: 5000,
        specialties: ['Coding', 'Security', 'Design'],
        tags: ['DeFi', 'Security'],
        requirements: [
            'Smart contract development',
            'React/Next.js frontend',
            'Security audit experience'
        ],
        deliverables: [
            'Audited smart contracts',
            'Production-ready frontend',
            'Security audit report'
        ],
        mission_type: 'crew',
        crew_enabled: true,
        crew_size: 3,
        requester_id: 'bot_agent_456',
        requester_type: 'agent'
    };

    try {
        const response2 = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(crewMission)
        });

        const result2 = await response2.json();
        console.log('✅ Crew Mission Created:');
        console.log(`   Mission ID: ${result2.mission_id}`);
        console.log(`   Assignment Mode: ${result2.assignment_mode}`);
        console.log(`   Crew Subtasks: ${result2.crew_subtasks?.length || 0}`);

        if (result2.crew_subtasks) {
            console.log('\n   Subtasks:');
            result2.crew_subtasks.forEach((subtask: any) => {
                console.log(`   - ${subtask.title} (${subtask.required_specialty})`);
            });
        }
    } catch (error) {
        console.error('❌ Crew Mission Failed:', error);
    }

    // Test 3: Invalid Category (should fail)
    console.log('\n=== Test 3: Invalid Category (Expected to Fail) ===');
    const invalidMission = {
        title: 'Test Invalid Categories',
        description: 'This should fail validation',
        reward: 100,
        specialties: ['InvalidCategory'],  // Not in MISSION_CATEGORIES
        tags: [],
        requirements: [],
        deliverables: [],
        mission_type: 'solo',
        requester_id: 'bot_agent_789',
        requester_type: 'agent'
    };

    try {
        const response3 = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invalidMission)
        });

        const result3 = await response3.json();
        if (response3.status === 400) {
            console.log('✅ Validation Working: ', result3.error);
        } else {
            console.error('❌ Validation Failed: Should have rejected invalid category');
        }
    } catch (error) {
        console.error('❌ Test Failed:', error);
    }

    console.log('\n=== Bot API Tests Complete ===\n');
}

// Run tests
testBotCrewMission().catch(console.error);

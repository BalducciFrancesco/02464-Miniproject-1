'use strict';

let experimentContainer;

let sampleFragment;
const SAMPLE_FRAGMENT = "components/sample.html"
const SAMPLE_OPTIONS = '123456789';
const SAMPLE_COUNT = 10;

let guessFragment;
const GUESS_FRAGMENT = "components/guess.html"

let formContainer;
let formData = {};

const SAMPLE_RATE = 500; 
const SAMPLE_GAP = 400; // ms blank gap between samples

document.addEventListener('DOMContentLoaded', async () => {
    experimentContainer = document.getElementById('experiment-container');
    formContainer = document.getElementById('setup-form');
    sampleFragment = await (await fetch(SAMPLE_FRAGMENT)).text();
    guessFragment = await (await fetch(GUESS_FRAGMENT)).text();
    // On startup, prefill from single shared key if present
    const studentInput = formContainer.querySelector('input[name="studentId"]');
    studentInput.value = localStorage.getItem('lastStudent') || '';
    // Inline modifier descriptions
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const descriptions = {
                'articulatory-suppression': 'Please do repeat "eerb eerb..." aloud while memorizing (not during recall).',
                'tapping': 'Please do draw a square with your fingers continuously while memorizing (not during recall).'
            };
            const label = cb.closest('label');
            if (!label) return;
            let desc = label.querySelector('small');
            if (cb.checked) {
                if (!desc) {
                    desc = document.createElement('small');
                    desc.textContent = descriptions[cb.name] || '';
                    label.appendChild(desc);
                }
            } else if (desc) {
                desc.remove();
            }
        });
    });
});

async function startExperiment(e) {
    formData = Object.fromEntries(new FormData(e.target).entries());

    if (!formData.studentId) {
        alert('Please enter your Student ID.');
        return;
    }

    let samples = generateSamples(SAMPLE_COUNT, formData.chunk)
    formContainer.style.display = 'none';
    await showSamples(samples);
    let guesses = await showGuesses(samples);
    downloadCSV(samples, guesses);
}

// Generate 10 random samples (with replacement)
function generateSamples(amount = SAMPLE_COUNT, chunk = false) {
    if (!chunk) {
        return Array.from({ length: amount }, () =>
            SAMPLE_OPTIONS[Math.floor(Math.random() * SAMPLE_OPTIONS.length)]
        );
    } else { // chunking: generate pairs like A B B A etc.
        const half = Math.floor(amount / 2);
        const samples = [];
        for (let i = 0; i < half; i++) {
            const a = SAMPLE_OPTIONS[Math.floor(Math.random() * SAMPLE_OPTIONS.length)];
            const b = SAMPLE_OPTIONS[Math.floor(Math.random() * SAMPLE_OPTIONS.length)];
            samples.push(a, b, b, a);
        }
        // If amount is odd, add one more random sample
        if (amount % 2 !== 0) {
            samples.push(SAMPLE_OPTIONS[Math.floor(Math.random() * SAMPLE_OPTIONS.length)]);
        }
        return samples.slice(0, amount);
    }
}

function showSamples(samples) {
    // simple async loop: show sample, wait (visible time), show blank, wait (gap)
    const wait = ms => new Promise(res => setTimeout(res, ms));
    function showSample(character, idx, total) {
        experimentContainer.innerHTML = sampleFragment
            .replace('{{ number }}', character)
            .replace('{{ idx }}', idx)
            .replace('{{ total }}', total);
    }
    return (async () => {
        for (let i = 0; i < samples.length; i++) {
            showSample(samples[i], i + 1, samples.length);
            // show the sample for the configured SAMPLE_RATE, then show a blank gap
            await wait(SAMPLE_RATE);
            showSample('\u00A0', i + 1, samples.length);
            await wait(SAMPLE_GAP);
        }
    })();
}

function showGuesses(samples, customText) {
    return new Promise(resolve => {
        const guesses = [];
        experimentContainer.innerHTML = guessFragment.replace('{{ text }}', customText || 'Write the characters IN THE ORDER you saw them');
        experimentContainer.querySelector('input').addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.target.value.trim().length !== 1)
                return;
            event.preventDefault();
            guesses.push(event.target.value.trim().toUpperCase());
            if (guesses.length < samples.length) { // check if more guesses are needed
                event.target.value = '';
            } else {
                resolve(guesses);
            }
        });
        experimentContainer.querySelector('button').addEventListener('click', (event) => {
            resolve(guesses);
        });
    });
}

// Inline modifier descriptions are handled by the delegated checkbox change listeners above.

function downloadCSV(samples, guesses) {
    const csv = 'sample,guess\n' + samples.map((s, i) => `${s},${guesses[i] || 'null'}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    let f = `${formData.studentId || 'unknown'}_free`;
    if (formData.delay) f += '_delay';
    if (formData.rate) f += '_rate';
    if (formData.task) f += '_task';
    a.download = f + '.csv';
    a.click();
    localStorage.setItem('lastStudent', formData.studentId);
    experimentContainer.innerHTML = '<p>Experiment complete! CSV downloaded. Refresh the page to start a new session.</p>';
}
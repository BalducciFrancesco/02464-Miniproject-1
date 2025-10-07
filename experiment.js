'use strict';

let experimentContainer;

let sampleFragment;
const SAMPLE_FRAGMENT = "components/sample.html"
const SAMPLE_OPTIONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&';
const SAMPLE_COUNT = 20;
const SAMPLE_COUNT_MOD = 5;

let guessFragment;
const GUESS_FRAGMENT = "components/guess.html"

let formContainer;
let formData = {};

const SAMPLE_RATE = 500; 
const SAMPLE_RATE_MOD = 1000; 
const SAMPLE_DELAY = 10000;
const SAMPLE_GAP = 200; // ms blank gap after each sample

document.addEventListener('DOMContentLoaded', async () => {
    experimentContainer = document.getElementById('experiment-container');
    formContainer = document.getElementById('setup-form');
    sampleFragment = await (await fetch(SAMPLE_FRAGMENT)).text();
    guessFragment = await (await fetch(GUESS_FRAGMENT)).text();
    // On startup, prefill from single shared key if present
    const studentInput = formContainer.querySelector('input[name="studentId"]');
    studentInput.value = localStorage.getItem('lastStudent') || '';
});

async function startExperiment(e) {
    formData = Object.fromEntries(new FormData(e.target).entries());

    if (!formData.studentId) {
        alert('Please enter your Student ID.');
        return;
    }

    let samples = generateSamples()
    formContainer.style.display = 'none';
    await showSamples(samples);
    if(formData.task)
        await showTask();
    if(formData.delay)
        await showDelay();
    let guesses = await showGuesses(samples);
    downloadCSV(samples, guesses);
}

// Generate 20 unique random samples
function generateSamples(amount = SAMPLE_COUNT) {
    const optionsArr = SAMPLE_OPTIONS.split('');
    const shuffled = optionsArr.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, amount);
}

function showSamples(samples) {
    // simple async loop: show sample for visibleDuration, then blank gap
    const wait = ms => new Promise(res => setTimeout(res, ms));
    function showSample(character, idx, total) {
        experimentContainer.innerHTML = sampleFragment
            .replace('{{ number }}', character)
            .replace('{{ idx }}', idx)
            .replace('{{ total }}', total);
    }
    return (async () => {
        for (let i = 0; i < samples.length; i++) {
            const visibleDuration = formData.rate ? SAMPLE_RATE_MOD : SAMPLE_RATE;
            showSample(samples[i], i + 1, samples.length);
            await wait(visibleDuration);
            showSample('\u00A0', i + 1, samples.length);
            await wait(SAMPLE_GAP);
        }
    })();
}

function showGuesses(samples, customText) {
    return new Promise(resolve => {
        const guesses = [];
        experimentContainer.innerHTML = guessFragment.replace('{{ text }}', customText || 'Write the characters in ANY order');
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


function showDelay() {
    return new Promise(resolve => {
        experimentContainer.innerHTML = '<article aria-busy="true"></article>';
        setTimeout(() => {
            resolve();
        }, SAMPLE_DELAY);
    });
}

async function showTask() {
    const fakeSamples = generateSamples(SAMPLE_COUNT_MOD);
    experimentContainer.innerHTML = '<p>But first, try to recall these +' + SAMPLE_COUNT_MOD + ' characters in REVERSE order:</p>';
    await new Promise(resolve => setTimeout(resolve, 5000));
    await showSamples(fakeSamples);
    await showGuesses(fakeSamples, `Write the last ${SAMPLE_COUNT_MOD} seen characters in REVERSE order.`);
    experimentContainer.innerHTML = '<p>Great! Now, try to recall the original characters.</p>';
    await new Promise(resolve => setTimeout(resolve, 2000));
}

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
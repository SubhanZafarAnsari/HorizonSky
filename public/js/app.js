(() => {
    'use strict';

    const API_BASE = window.location.origin;

    // Keeps track of the current search/quote so the sticky lead form
    // always submits alongside the right route + price context.
    const state = {
        from: '',
        to: '',
        departDate: '',
        returnDate: '',
        passengers: '2_adults_economy',
        quote: null // filled in once /api/search resolves
    };

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    document.getElementById('footerYear').textContent = new Date().getFullYear();

    // =====================================================================
    // Tabs (Flights / Hotels) — Hotels is a visual placeholder for now
    // =====================================================================
    $$('.tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            $$('.tab').forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    // Mobile nav toggle
    const navToggle = $('.nav-toggle');
    const navLinks = $('.nav-links');
    navToggle.addEventListener('click', () => {
        const showing = navLinks.style.display === 'flex';
        navLinks.style.display = showing ? 'none' : 'flex';
        navLinks.style.cssText += showing
            ? ''
            : 'position:absolute;top:100%;left:0;right:0;background:#fff;flex-direction:column;padding:16px 5%;box-shadow:0 8px 20px rgba(0,0,0,0.08);gap:14px;';
    });

    // =====================================================================
    // Helpers
    // =====================================================================
    function airportCodeGuess(cityText) {
        const cleaned = (cityText || '').replace(/[^a-zA-Z ]/g, '').trim();
        if (!cleaned) return '---';
        const words = cleaned.split(/\s+/);
        if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
        return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
    }

    function passengerCount(value) {
        const map = {
            '1_adult_economy': 1,
            '2_adults_economy': 2,
            '1_adult_business': 1
        };
        return map[value] || 2;
    }

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function setFieldError(inputEl, errorEl, message) {
        if (message) {
            inputEl.classList.add('field-error');
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        } else {
            inputEl.classList.remove('field-error');
            errorEl.style.display = 'none';
        }
    }

    // =====================================================================
    // PHASE 1 -> PHASE 2: initial flight search
    // =====================================================================
    const heroSection = $('#heroSection');
    const quoteSection = $('#quoteSection');
    const quoteLeft = $('#quoteLeft');
    const searchForm = $('#flightSearchForm');
    const searchBtn = $('#searchBtn');

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const from = $('#departure').value.trim();
        const to = $('#destination').value.trim();
        const departDate = $('#departDate').value;
        const returnDate = $('#returnDate').value;
        const passengers = $('#passengers').value;

        if (!from || !to) return;

        state.from = from;
        state.to = to;
        state.departDate = departDate;
        state.returnDate = returnDate;
        state.passengers = passengers;

        // Mirror into the sticky right-panel form so it's pre-filled.
        $('#leadFrom').value = from;
        $('#leadTo').value = to;

        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching...';

        quoteSection.style.display = 'flex';
        renderLoadingState();
        quoteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const MIN_LOADING_MS = 2400;
        const startedAt = Date.now();

        let quote = null;
        try {
            const res = await fetch(`${API_BASE}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from, to, departDate, returnDate, passengers })
            });
            quote = await res.json();
        } catch (err) {
            console.error('Search failed:', err);
        }

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
        await new Promise((resolve) => setTimeout(resolve, remaining));

        state.quote = quote;
        searchBtn.disabled = false;
        searchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Search Flights';

        if (quote && !quote.error) {
            renderResultsState(quote);
        } else {
            renderResultsState(fallbackQuote(from, to));
        }
    });

    function fallbackQuote(from, to) {
        return {
            from: { raw: from, code: airportCodeGuess(from) },
            to: { raw: to, code: airportCodeGuess(to) },
            originalPrice: 1289,
            price: 989,
            savingsPercent: 23,
            airlines: [
                { name: 'Pinnacle Air', tag: 'Prestige Carrier' },
                { name: 'Meridian Alliance', tag: 'Global Network' },
                { name: 'Continental Wings', tag: 'Partner Airline' }
            ]
        };
    }

    // =====================================================================
    // Route summary header — shared across loading / results states
    // =====================================================================
    function routeSummaryHTML(fromCode, fromCity, toCode, toCity) {
        return `
            <div class="route-summary">
                <div class="route-endpoint from">
                    <div class="code">${escapeHtml(fromCode)}</div>
                    <div class="city">${escapeHtml(fromCity)}</div>
                </div>
                <div class="route-path">
                    <div class="plane-line"><span class="line"></span><i class="fa-solid fa-plane"></i><span class="line"></span></div>
                    <div class="route-meta">
                        <span>${state.passengers.includes('business') ? 'Business' : 'Economy'}</span>
                        <span>${state.returnDate ? 'Round-Trip' : 'One-Way'}</span>
                        <span><i class="fa-solid fa-user"></i> ${passengerCount(state.passengers)}</span>
                    </div>
                </div>
                <div class="route-endpoint to">
                    <div class="code">${escapeHtml(toCode)}</div>
                    <div class="city">${escapeHtml(toCity)}</div>
                </div>
                <button type="button" class="edit-route-btn" id="editRouteBtn" title="Edit search">
                    <i class="fa-solid fa-pen"></i>
                </button>
            </div>
        `;
    }

    function bindEditRouteBtn() {
        const btn = $('#editRouteBtn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            heroSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            $('#departure').focus();
        });
    }

    // =====================================================================
    // PHASE 2a — loading state
    // =====================================================================
    let progressTimer = null;

    function renderLoadingState() {
        const fromCode = airportCodeGuess(state.from);
        const toCode = airportCodeGuess(state.to);

        quoteLeft.innerHTML = `
            <div class="fade-up">
                <span class="price-guarantee-badge"><i class="fa-solid fa-shield-halved"></i> Best offline price guarantee</span>
                ${routeSummaryHTML(fromCode, state.from, toCode, state.to)}
                <div class="loading-state">
                    <span class="progress-percent" id="progressPercent">0%</span>
                    <div class="progress-track">
                        <div class="progress-fill" id="progressFill"></div>
                        <i class="fa-solid fa-plane progress-plane" id="progressPlane"></i>
                    </div>
                    <p class="loading-label">Searching the best flight options&hellip;</p>
                </div>
                <div class="membership-teaser">
                    <p>Discover an all-in-one travel membership that pays you back</p>
                    <div class="membership-brands">
                        <span class="brand-word">HORIZON<span>SKY</span></span>
                        <span class="sep">&times;</span>
                        <span class="membership-plus"><i class="fa-solid fa-gem"></i> HorizonSky+</span>
                    </div>
                </div>
            </div>
        `;

        bindEditRouteBtn();
        animateProgress();
    }

    function animateProgress() {
        const fill = $('#progressFill');
        const plane = $('#progressPlane');
        const percentLabel = $('#progressPercent');
        if (!fill) return;

        clearInterval(progressTimer);
        let pct = 0;
        // Ease toward ~92% while waiting on the network; final jump to 100%
        // happens explicitly when renderResultsState() takes over.
        progressTimer = setInterval(() => {
            const remaining = 92 - pct;
            pct += Math.max(0.6, remaining * 0.06);
            if (pct >= 92) pct = 92;
            fill.style.width = pct + '%';
            plane.style.left = pct + '%';
            percentLabel.textContent = Math.round(pct) + '%';
            if (pct >= 92) clearInterval(progressTimer);
        }, 120);
    }

    // =====================================================================
    // PHASE 2b — results state
    // =====================================================================
    function renderResultsState(quote) {
        clearInterval(progressTimer);

        const fromCode = quote.from?.code || airportCodeGuess(state.from);
        const toCode = quote.to?.code || airportCodeGuess(state.to);
        const airlines = quote.airlines || [];

        state.quotedPriceLabel = `$${quote.price}`;

        quoteLeft.innerHTML = `
            <div class="fade-up">
                <span class="price-guarantee-badge"><i class="fa-solid fa-shield-halved"></i> Best offline price guarantee</span>
                ${routeSummaryHTML(fromCode, state.from, toCode, state.to)}

                <div class="price-block">
                    <div class="price-col">
                        <div class="original-price">$${quote.originalPrice.toLocaleString()}</div>
                        <div class="final-price">$${quote.price.toLocaleString()}<sup>*</sup></div>
                        <div class="price-caption">Total, per person</div>
                        <span class="savings-pill"><i class="fa-solid fa-arrow-down"></i> Save ${quote.savingsPercent}%</span>
                    </div>
                    <ul class="perk-list">
                        <li><i class="fa-solid fa-circle-check"></i> Lost Baggage Protection</li>
                        <li><i class="fa-solid fa-circle-check"></i> Refund Assurance</li>
                        <li><i class="fa-solid fa-circle-check"></i> Book Now, Pay Later</li>
                    </ul>
                </div>

                <div class="partner-row">
                    ${airlines.map((a) => `
                        <span class="partner-logo"><i class="fa-solid fa-plane-up"></i> ${escapeHtml(a.name)}</span>
                    `).join('')}
                </div>

                <div class="membership-teaser">
                    <p>Discover an all-in-one travel membership that pays you back</p>
                    <div class="membership-brands">
                        <span class="brand-word">HORIZON<span>SKY</span></span>
                        <span class="sep">&times;</span>
                        <span class="membership-plus"><i class="fa-solid fa-gem"></i> HorizonSky+ unlocks extra savings</span>
                    </div>
                </div>
            </div>
        `;

        bindEditRouteBtn();
    }

    // =====================================================================
    // PHASE 3 — thank-you state (after lead form submit)
    // =====================================================================
    function renderThankYouState() {
        quoteLeft.innerHTML = `
            <div class="fade-up thankyou-state">
                <div class="thankyou-icon"><i class="fa-solid fa-check"></i></div>
                <h3>Thank you for the request!</h3>
                <p>You will get a reply from a Travel Agent shortly.</p>
                <button type="button" class="thankyou-close-btn" id="thankYouCloseBtn">Close</button>

                <div class="follow-us">
                    <p>Follow Us:</p>
                    <div class="social-row">
                        <a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook-f"></i></a>
                        <a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
                        <a href="#" aria-label="YouTube"><i class="fa-brands fa-youtube"></i></a>
                        <a href="#" aria-label="X"><i class="fa-brands fa-x-twitter"></i></a>
                        <a href="#" aria-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
                    </div>
                </div>
            </div>
        `;

        $('#thankYouCloseBtn').addEventListener('click', () => {
            quoteSection.style.display = 'none';
            searchForm.reset();
            $('#passengers').value = '2_adults_economy';
            heroSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // =====================================================================
    // Lead form (right panel) — swap cities button
    // =====================================================================
    $('#swapCitiesBtn').addEventListener('click', () => {
        const fromEl = $('#leadFrom');
        const toEl = $('#leadTo');
        const tmp = fromEl.value;
        fromEl.value = toEl.value;
        toEl.value = tmp;
    });

    // =====================================================================
    // Lead form submit — validate, persist, then react to server verdict
    // =====================================================================
    const leadForm = $('#leadForm');
    const leadSubmitBtn = $('#leadSubmitBtn');

    function quickEmailShapeOk(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    }

    function quickPhoneShapeOk(phone) {
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15;
    }

    leadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const from = $('#leadFrom').value.trim() || state.from;
        const to = $('#leadTo').value.trim() || state.to;
        const email = $('#leadEmail').value.trim();
        const phone = $('#leadPhone').value.trim();
        const countryCode = $('#countryCode').value;
        const name = $('#leadName').value.trim();
        const hotelNeeded = $('#hotelNeeded').checked;

        const emailInput = $('#leadEmail');
        const phoneInput = $('#leadPhone');
        const emailErrorEl = $('#emailError');
        const phoneErrorEl = $('#phoneError');

        let hasClientError = false;
        if (!quickEmailShapeOk(email)) {
            setFieldError(emailInput, emailErrorEl, 'Please enter a valid email address.');
            hasClientError = true;
        } else {
            setFieldError(emailInput, emailErrorEl, null);
        }

        if (!quickPhoneShapeOk(phone)) {
            setFieldError(phoneInput, phoneErrorEl, 'Please enter a valid phone number.');
            hasClientError = true;
        } else {
            setFieldError(phoneInput, phoneErrorEl, null);
        }

        if (hasClientError) return;

        leadSubmitBtn.disabled = true;
        leadSubmitBtn.textContent = 'Sending...';

        const payload = {
            from, to,
            departDate: state.departDate,
            returnDate: state.returnDate,
            passengers: state.passengers,
            name, email, phone, countryCode,
            hotelNeeded,
            quotedPrice: state.quotedPriceLabel || null
        };

        let result = { success: true, valid: true };
        try {
            const res = await fetch(`${API_BASE}/api/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            result = await res.json();
        } catch (err) {
            console.error('Lead submission failed:', err);
        }

         // Send email notification via EmailJS (fire-and-forget, doesn't block UI)
        emailjs.send('service_q993bp2', 'template_xerm2ie', {
            name: name,
            email: email,
            phone: `${countryCode} ${phone}`,
            from_city: from,
            to_city: to,
            depart_date: state.departDate,
            return_date: state.returnDate,
            passengers: state.passengers,
            quoted_price: state.quotedPriceLabel || 'N/A',
            hotel_needed: hotelNeeded ? 'Yes' : 'No'
        }).catch((err) => console.error('EmailJS error:', err));

        leadSubmitBtn.disabled = false;
        leadSubmitBtn.textContent = 'GET A FREE QUOTE';

        // The left panel always shows the thank-you confirmation immediately —
        // matching a real agent who will "follow up shortly" either way.
        renderThankYouState();
        quoteLeft.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (result && result.valid === false) {
            const displayValue = result.invalidField === 'phone'
                ? `${countryCode} ${phone}`
                : email;
            scheduleUnableToConnectToast(displayValue);
        }
    });

    // =====================================================================
    // Toast — "we attempted to reach you but were unable to connect"
    // =====================================================================
    const toastEl = $('#connectToast');
    const toastMessageEl = $('#toastMessage');
    const toastCloseBtn = $('#toastCloseBtn');
    const connectAgentBtn = $('#connectAgentBtn');
    let toastTimer = null;

    function scheduleUnableToConnectToast(badValue) {
        clearTimeout(toastTimer);
        // Simulates a brief real call-attempt window before falling back.
        toastTimer = setTimeout(() => {
            toastMessageEl.textContent =
                `We attempted to reach you by ${badValue} but were unable to connect. ` +
                `We're happy to assist you with your inquiry here. Please click on "Connect with Agent" ` +
                `and we will find the first available agent to help you promptly.`;
            toastEl.classList.add('visible');
        }, 3800);
    }

    toastCloseBtn.addEventListener('click', () => {
        toastEl.classList.remove('visible');
    });

    connectAgentBtn.addEventListener('click', () => {
        connectAgentBtn.classList.add('connecting');
        connectAgentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
        // tel: link still fires on click; we just give quick visual feedback
        // before the toast dismisses itself.
        setTimeout(() => {
            toastEl.classList.remove('visible');
            connectAgentBtn.classList.remove('connecting');
            connectAgentBtn.innerHTML = '<i class="fa-solid fa-headset"></i> Connect with Agent';
        }, 1400);
    });
})();

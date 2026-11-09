(() => {
    const container = document.getElementById('public-plans');
    const modal = document.getElementById('plan-custom-modal');
    if (!container) return;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const money = value => Number(value).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
    let availablePlans = [];
    const closeModal = () => {
        modal?.classList.remove('active');
        modal?.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('plan-modal-open');
    };
    const updateCount = () => {
        const count = document.querySelectorAll('#customPlanServices input:checked').length;
        const output = document.getElementById('customPlanCount');
        if (output) output.textContent = String(count);
    };
    const renderServices = plan => {
        const box = document.getElementById('customPlanServices');
        if (!box) return;
        const features = Array.isArray(plan?.features) ? plan.features : [];
        box.innerHTML = features.map((feature, index) => `<label class="custom-service-option"><input type="checkbox" value="${escapeHtml(feature)}" checked><span>${escapeHtml(feature)}</span></label>`).join('') || '<p class="muted">Este plano ainda não possui serviços cadastrados.</p>';
        box.querySelectorAll('input').forEach(input => input.addEventListener('change', updateCount));
        updateCount();
    };
    const openModal = planId => {
        if (!modal || !availablePlans.length) return;
        const select = document.getElementById('customPlanBase');
        select.innerHTML = availablePlans.map(plan => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</option>`).join('');
        const plan = availablePlans.find(item => item.id === planId) || availablePlans[0];
        select.value = plan.id;
        document.getElementById('customPlanName').value = `${plan.name} personalizado`.slice(0, 80);
        document.getElementById('customPlanNotes').value = '';
        renderServices(plan);
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('plan-modal-open');
        setTimeout(() => document.getElementById('customPlanName').focus(), 40);
    };
    const renderPlans = plans => {
        if (!Array.isArray(plans)) return;
        availablePlans = plans;
        if (!plans.length) {
            container.innerHTML = '<div class="plans-empty">Nossos planos estão sendo atualizados. Entre em contato para receber uma proposta.</div>';
            return;
        }
        container.innerHTML = plans.map(plan => {
            const price = plan.price === null || plan.price === undefined || plan.price === '' ? 'Consultar' : money(plan.price);
            const label = plan.priceLabel ? `<small>${escapeHtml(plan.priceLabel)}</small>` : '';
            const features = (Array.isArray(plan.features) ? plan.features : []).map(feature => `<p><span>✓</span> ${escapeHtml(feature)}</p>`).join('');
            return `<article class="plan-card ${plan.featured ? 'featured' : ''}">${plan.featured ? '<span class="featured-label">Mais escolhido</span>' : ''}<div class="plan-header"><span>${escapeHtml(plan.name)}</span>${label}<h3>${escapeHtml(price)}</h3><p>${escapeHtml(plan.description)}</p></div><div class="plan-body">${features}<button type="button" class="plan-customize-button" data-customize-plan="${escapeHtml(plan.id)}">Personalizar plano</button></div></article>`;
        }).join('');
        container.querySelectorAll('[data-customize-plan]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.customizePlan)));
    };
    fetch('/api/plans')
        .then(response => {
            if (!response.ok) throw new Error('Não foi possível carregar os planos.');
            return response.json();
        })
        .then(renderPlans)
        .catch(() => {
            container.querySelectorAll('.plan-card').forEach(card => {
                if (!card.querySelector('.plan-customize-button')) {
                    const button = document.createElement('a');
                    button.className = 'plan-customize-button';
                    button.href = 'index.html';
                    button.textContent = 'Entrar para solicitar';
                    card.querySelector('.plan-body')?.appendChild(button);
                }
            });
        });
    document.querySelectorAll('[data-close-custom-modal]').forEach(button => button.addEventListener('click', closeModal));
    document.getElementById('customPlanBase')?.addEventListener('change', event => {
        const plan = availablePlans.find(item => item.id === event.target.value);
        if (!plan) return;
        document.getElementById('customPlanName').value = `${plan.name} personalizado`.slice(0, 80);
        renderServices(plan);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal?.classList.contains('active')) closeModal();
    });
    document.getElementById('customPlanForm')?.addEventListener('submit', event => {
        event.preventDefault();
        const name = document.getElementById('customPlanName').value.trim();
        const plan = availablePlans.find(item => item.id === document.getElementById('customPlanBase').value);
        const selected = [...document.querySelectorAll('#customPlanServices input:checked')].map(input => input.value);
        const notes = document.getElementById('customPlanNotes').value.trim();
        if (!name) return document.getElementById('customPlanName').focus();
        if (!selected.length) {
            window.alert('Selecione pelo menos um serviço para continuar.');
            return;
        }
        const message = [
            'Olá! Quero solicitar um orçamento com um plano personalizado pela Imperio Cerimonial.',
            '',
            `Nome da proposta: ${name}`,
            `Plano de referência: ${plan?.name || ''}`,
            `Preço de referência: ${plan?.price === null || plan?.price === undefined ? 'Consultar' : money(plan.price)}`,
            '',
            'Serviços desejados:',
            ...selected.map(service => `- ${service}`),
            '',
            'Personalizações e observações:',
            notes || 'Nenhuma'
        ].join('\n');
        closeModal();
        window.open(`https://wa.me/5531975814393?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    });
})();

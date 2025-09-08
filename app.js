// Sistema de Vouchers - JavaScript Principal
class VoucherSystem {
    constructor() {
        this.editingVoucherId = null;
        this.autocompleteData = this.loadAutocompleteData();
        this.init();
    }

    formatDateDDMMYY(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        return `${day}-${month}-${year}`;
    }

    convertDateToISO(dateString) {
        if (!dateString) return '';
        // Se já está no formato YYYY-MM-DD, retorna como está
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
        }
        // Se está no formato DD-MM-YYYY, converte para YYYY-MM-DD
        if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
            const [day, month, year] = dateString.split('-');
            return `${year}-${month}-${day}`;
        }
        return dateString;
    }
    
    async handlePDFTemplateUpload(e) {
        const file = e.target.files[0];
        const statusDiv = document.getElementById('pdf-template-status');
        
        if (file && file.type === 'application/pdf') {
            try {
                statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando template...';
                statusDiv.className = 'template-status loading';
                
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                let binaryString = '';
                for (let i = 0; i < uint8Array.length; i++) {
                    binaryString += String.fromCharCode(uint8Array[i]);
                }
                const base64 = btoa(binaryString);
                localStorage.setItem('pdfTemplate', base64);
                
                statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Template carregado com sucesso!';
                statusDiv.className = 'template-status success';
                
                this.showSuccessMessage('Template PDF carregado e salvo!');
                
            } catch (error) {
                console.error('Erro ao carregar template:', error);
                statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Erro ao carregar template';
                statusDiv.className = 'template-status error';
                this.showErrorMessage('Erro ao carregar template PDF.');
            }
        } else {
            statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Por favor, selecione um arquivo PDF válido';
            statusDiv.className = 'template-status error';
        }
    }

    fillPDFFields(form, voucherData, agencyConfig) {
        try {
            // Mapear dados gerais da viagem
            this.setFieldValue(form, 'local_embarque', voucherData.boardingLocation);
            this.setFieldValue(form, 'contato_01', voucherData.contractorPhone1);
            this.setFieldValue(form, 'contato_02', voucherData.contractorPhone2);
            this.setFieldValue(form, 'observacao', voucherData.observations);
            
            // Mapear destinos (até 7)
            if (voucherData.destinations) {
                voucherData.destinations.forEach((dest, index) => {
                    if (index < 7) {
                        const num = String(index + 1).padStart(2, '0');
                        this.setFieldValue(form, `destino_${num}`, dest.destination);
                        this.setFieldValue(form, `data_${num}`, dest.date);
                        this.setFieldValue(form, `horario_${num}`, dest.time);
                    }
                });
            }
            
            // Mapear passageiros (até 10)
            if (voucherData.passengers) {
                voucherData.passengers.forEach((passenger, index) => {
                    if (index < 10) {
                        const num = String(index + 1).padStart(2, '0');
                        this.setFieldValue(form, `passageiro_${num}`, passenger);
                    }
                });
            }
            
            // Mapear dados financeiros e quantitativos
            this.setFieldValue(form, 'qt_adulto', voucherData.adults?.toString() || '0');
            this.setFieldValue(form, 'qt_crianca', voucherData.childCount?.toString() || '0');
            this.setFieldValue(form, 'qt_colo', voucherData.infantCount?.toString() || '0');
            this.setFieldValue(form, 'total_passageiros', voucherData.totalPassengers?.toString() || '0');
            this.setFieldValue(form, 'total_a_pagar', voucherData.totalAmount?.toString() || '0');
            this.setFieldValue(form, 'pre_reserva', voucherData.advancePayment?.toString() || '0');
            this.setFieldValue(form, 'falta_pagar', voucherData.remainingAmount?.toString() || '0');
            
            // Mapear dados do contratante
            this.setFieldValue(form, 'data_contrato', voucherData.contractDate);
            this.setFieldValue(form, 'nome_contratante', voucherData.contractorName);
            this.setFieldValue(form, 'cpf_contratante', voucherData.contractorCpf);
            this.setFieldValue(form, 'email_contratante', voucherData.contractorEmail);
            
        } catch (error) {
            console.error('Erro ao preencher campos do PDF:', error);
        }
    }
    
    setFieldValue(form, fieldName, value) {
        try {
            if (value !== undefined && value !== null && value !== '') {
                const field = form.getField(fieldName);
                if (field) {
                    field.setText(String(value));
                }
            }
        } catch (error) {
            console.warn(`Campo '${fieldName}' não encontrado no PDF template:`, error);
        }
    }

    init() {
        this.setupEventListeners();
        this.loadApp();
        this.setupAutocomplete();
        this.setupFormCalculations();
        this.setupMasks();
    }

    // Inicialização da aplicação
    loadApp() {
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            
            // Verificar se a agência já foi configurada
            const agencyConfig = this.getAgencyConfig();
            if (!agencyConfig || !agencyConfig.name) {
                this.showConfigScreen();
            } else {
                this.showVouchersListScreen();
            }
        }, 1500);
    }

    // Event Listeners
    setupEventListeners() {
        // Botões de navegação
        document.getElementById('config-btn').addEventListener('click', () => this.showConfigScreen());
        document.getElementById('new-voucher-btn').addEventListener('click', () => this.showVoucherFormScreen());
        document.getElementById('back-to-list-btn').addEventListener('click', () => this.showVouchersListScreen());
        
        // Botão para ir da configuração para vouchers
        document.getElementById('go-to-vouchers-btn').addEventListener('click', () => {
            const agencies = this.getAllAgencies();
            if (agencies.length === 0) {
                this.showErrorMessage('Configure pelo menos uma agência antes de continuar.');
                return;
            }
            this.showVouchersListScreen();
        });

        // Formulário de configuração da agência
        document.getElementById('agency-config-form').addEventListener('submit', (e) => this.saveAgencyConfig(e));
        
        // Upload de template PDF
        document.getElementById('pdf-template').addEventListener('change', (e) => this.handlePDFTemplateUpload(e));
        
        // Seleção de agência e template no formulário de voucher
        document.getElementById('selected-agency').addEventListener('change', (e) => this.loadTemplatesForAgency(e.target.value));
        document.getElementById('selected-template').addEventListener('change', (e) => this.selectTemplate(e.target.value));
        


        // Formulário de voucher
        document.getElementById('save-voucher-btn').addEventListener('click', () => this.saveVoucher());
        document.getElementById('preview-pdf-btn').addEventListener('click', () => this.generatePDF());
        
        // Destinos
        document.getElementById('add-destination-btn').addEventListener('click', () => this.addDestination());
        
        // Passageiros
        document.getElementById('add-passenger-btn').addEventListener('click', () => this.addPassenger());
        
        // Cálculos automáticos
        document.querySelectorAll('.passenger-count').forEach(input => {
            input.addEventListener('input', () => this.calculateTotalPassengers());
        });
        
        document.querySelectorAll('.money-input').forEach(input => {
            input.addEventListener('input', () => this.calculateRemainingAmount());
        });

        // Data padrão do contrato
        document.getElementById('contract-date').value = new Date().toISOString().split('T')[0];
    }

    // Máscaras de entrada
    setupMasks() {

        
        // Máscara para CPF
        document.querySelectorAll('input[id*="cpf"]').forEach(input => {
            input.addEventListener('input', (e) => {
                e.target.value = this.maskCPF(e.target.value);
            });
        });
        
        // Máscara para telefone
        document.querySelectorAll('input[type="tel"]').forEach(input => {
            input.addEventListener('input', (e) => {
                e.target.value = this.maskPhone(e.target.value);
            });
        });
    }

    // Funções de máscara
    maskCNPJ(value) {
        return value.replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    }

    maskCPF(value) {
        return value.replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    }

    maskPhone(value) {
        return value.replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .replace(/(-\d{4})\d+?$/, '$1');
    }

    // Navegação entre telas
    showConfigScreen() {
        this.hideAllScreens();
        document.getElementById('config-screen').style.display = 'block';
        this.loadAgencyConfig();
    }

    showVouchersListScreen() {
        this.hideAllScreens();
        document.getElementById('vouchers-list-screen').style.display = 'block';
        this.loadVouchersList();
    }

    showVoucherFormScreen(voucherId = null) {
        this.hideAllScreens();
        document.getElementById('voucher-form-screen').style.display = 'block';
        
        // Carregar opções de agentes
        this.loadAgentOptions();
        
        if (voucherId) {
            this.editingVoucherId = voucherId;
            document.getElementById('voucher-form-title').innerHTML = '<i class="fas fa-edit"></i> Editar Voucher';
            // Aguardar um pouco para garantir que o DOM está pronto
            setTimeout(() => {
                this.loadVoucherForEdit(voucherId);
            }, 100);
        } else {
            this.editingVoucherId = null;
            document.getElementById('voucher-form-title').innerHTML = '<i class="fas fa-plus"></i> Novo Voucher';
            this.resetVoucherForm();
        }
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.display = 'none';
        });
    }

    // Configuração da Agência
    saveAgencyConfig(e) {
        e.preventDefault();
        
        const agencyName = document.getElementById('agency-name').value;
        const templateFile = document.getElementById('pdf-template').files[0];
        
        if (!templateFile) {
            this.showErrorMessage('Por favor, selecione um template PDF.');
            return;
        }
        
        // Salvar agência com template
        this.saveAgencyWithTemplate(agencyName, templateFile);
        
        this.showSuccessMessage('Agência adicionada com sucesso!');
        
        // Limpar formulário
        document.getElementById('agency-name').value = '';
        document.getElementById('pdf-template').value = '';
        document.getElementById('pdf-template-status').textContent = '';
        
        // Recarregar lista de agências
        this.loadAgenciesList();
    }

    async saveAgencyWithTemplate(agencyName, templateFile) {
        try {
            // Ler o arquivo PDF como ArrayBuffer
            const arrayBuffer = await templateFile.arrayBuffer();
            const templateData = {
                name: templateFile.name,
                data: Array.from(new Uint8Array(arrayBuffer)),
                uploadedAt: new Date().toISOString()
            };
            
            // Obter agências existentes
            const agencies = this.getAllAgencies();
            
            // Verificar se a agência já existe
            let existingAgency = agencies.find(agency => agency.name === agencyName);
            
            if (existingAgency) {
                // Adicionar template à agência existente
                existingAgency.templates.push(templateData);
            } else {
                // Criar nova agência
                const newAgency = {
                    id: this.generateId(),
                    name: agencyName,
                    templates: [templateData],
                    createdAt: new Date().toISOString()
                };
                agencies.push(newAgency);
            }
            
            // Salvar todas as agências
            localStorage.setItem('agencies', JSON.stringify(agencies));
            
            // Atualizar opções no formulário
            this.loadAgencyOptions();
            
        } catch (error) {
            console.error('Erro ao salvar agência e template:', error);
            this.showErrorMessage('Erro ao salvar agência e template.');
        }
    }
    
    getAllAgencies() {
        const agencies = localStorage.getItem('agencies');
        return agencies ? JSON.parse(agencies) : [];
    }
    
    loadAgencyOptions() {
        const agencies = this.getAllAgencies();
        const select = document.getElementById('selected-agency');
        
        if (select) {
            select.innerHTML = '<option value="">Selecione uma agência...</option>';
            
            agencies.forEach(agency => {
                const option = document.createElement('option');
                option.value = agency.id;
                option.textContent = agency.name;
                select.appendChild(option);
            });
        }
    }
    
    loadTemplatesForAgency(agencyId) {
        const agencies = this.getAllAgencies();
        const agency = agencies.find(a => a.id === agencyId);
        const templateSelect = document.getElementById('selected-template');
        
        if (!templateSelect) return;
        
        templateSelect.innerHTML = '<option value="">Selecione um template...</option>';
        
        if (agency && agency.templates) {
            agency.templates.forEach((template, index) => {
                const option = document.createElement('option');
                option.value = `${agencyId}-${index}`;
                option.textContent = template.name;
                templateSelect.appendChild(option);
            });
            
            // Seleção automática do primeiro template sempre que houver templates
            if (agency.templates.length > 0) {
                templateSelect.value = `${agencyId}-0`;
                this.selectTemplate(`${agencyId}-0`);
            }
        }
    }
    
    selectTemplate(templateId) {
        if (!templateId) return;
        
        const [agencyId, templateIndex] = templateId.split('-');
        const agencies = this.getAllAgencies();
        const agency = agencies.find(a => a.id === agencyId);
        
        if (agency && agency.templates[templateIndex]) {
            this.currentTemplate = {
                agency: agency,
                template: agency.templates[templateIndex]
            };
        }
    }
    
    loadAgencyConfig() {
        // Carregar opções de agências no formulário
        this.loadAgencyOptions();
        
        // Carregar lista de agências na tela de configuração
        this.loadAgenciesList();
        
        // Verificar se há configuração antiga para migrar
        const oldConfig = this.getAgencyConfig();
        if (oldConfig && oldConfig.name) {
            // Migrar para o novo sistema se necessário
            if (!this.getAllAgencies().find(agency => agency.name === oldConfig.name)) {
                // Esta migração será feita quando o usuário salvar novamente
            }
            
            this.loadAgentOptions();
        }
    }
    
    loadAgenciesList() {
        const agenciesList = document.getElementById('agencies-list');
        if (!agenciesList) return;
        
        const agencies = this.getAllAgencies();
        
        if (agencies.length === 0) {
            agenciesList.innerHTML = '<div class="empty-agencies">Nenhuma agência cadastrada ainda.</div>';
            return;
        }
        
        agenciesList.innerHTML = agencies.map(agency => `
            <div class="agency-item">
                <div class="agency-info">
                    <div class="agency-name">${agency.name}</div>
                    <div class="agency-templates">${agency.templates.length} template(s) cadastrado(s)</div>
                </div>
                <div class="agency-actions">
                    <button class="btn btn-danger btn-small remove-agency-btn" data-agency-id="${agency.id}">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </div>
        `).join('');
        
        // Adicionar event listeners para os botões de remover
        const removeButtons = agenciesList.querySelectorAll('.remove-agency-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const agencyId = button.getAttribute('data-agency-id');
                this.removeAgency(agencyId);
            });
        });
    }
    
    removeAgency(agencyId) {
        // Validar se o ID da agência foi fornecido
        if (!agencyId) {
            this.showErrorMessage('ID da agência não fornecido.');
            return;
        }
        
        const agencies = this.getAllAgencies();
        
        // Verificar se a agência existe
        const agencyToRemove = agencies.find(agency => agency.id === agencyId);
        if (!agencyToRemove) {
            this.showErrorMessage('Agência não encontrada.');
            return;
        }
        
        // Confirmar remoção
        if (!confirm(`Tem certeza que deseja remover a agência "${agencyToRemove.name}"? Esta ação não pode ser desfeita.`)) {
            return;
        }
        
        try {
            const updatedAgencies = agencies.filter(agency => agency.id !== agencyId);
            localStorage.setItem('agencies', JSON.stringify(updatedAgencies));
            
            this.showSuccessMessage('Agência removida com sucesso!');
            this.loadAgenciesList();
            this.loadAgencyOptions();
        } catch (error) {
            console.error('Erro ao remover agência:', error);
            this.showErrorMessage('Erro ao remover agência. Tente novamente.');
        }
    }

    getAgencyConfig() {
        const config = localStorage.getItem('agencyConfig');
        return config ? JSON.parse(config) : null;
    }

    // Upload de imagens
    // Lista de Vouchers
    loadVouchersList() {
        const vouchers = this.getAllVouchers();
        const container = document.getElementById('vouchers-list');
        const emptyState = document.getElementById('empty-state');
        
        if (vouchers.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        container.style.display = 'block';
        emptyState.style.display = 'none';
        
        container.innerHTML = vouchers.map(voucher => this.createVoucherListItem(voucher)).join('');
        
        // Adicionar event listeners para ações
        container.querySelectorAll('.edit-voucher-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const voucherItem = e.target.closest('.voucher-item');
                const voucherId = voucherItem.dataset.voucherId;
                this.showVoucherFormScreen(voucherId);
            });
        });
        
        container.querySelectorAll('.delete-voucher-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const voucherId = e.target.closest('.voucher-item').dataset.voucherId;
                this.deleteVoucher(voucherId);
            });
        });
        
        container.querySelectorAll('.generate-pdf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const voucherId = e.target.closest('.voucher-item').dataset.voucherId;
                this.generatePDFFromVoucher(voucherId);
            });
        });
    }

    createVoucherListItem(voucher) {
        const destinations = voucher.destinations.map(d => d.destination).join(', ');
        const totalPassengers = voucher.adults + voucher.children + voucher.infants;
        
        // Buscar nome do agente responsável
        const config = this.getAgencyConfig();
        let agentName = 'Agente não informado';
        if (config && config.agents && voucher.responsibleAgent) {
            const agent = config.agents.find(a => a.id === voucher.responsibleAgent);
            if (agent) {
                agentName = agent.name;
            }
        }
        
        return `
            <div class="voucher-item" data-voucher-id="${voucher.id}">
                <div class="voucher-header">
                    <div>
                        <div class="voucher-title">${voucher.contractorName}</div>
                        <div class="voucher-date">Criado em ${this.formatDateDDMMYY(voucher.createdAt)}</div>
                    </div>
                    <div class="voucher-actions">
                        <button class="btn btn-secondary edit-voucher-btn">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-success generate-pdf-btn">
                            <i class="fas fa-file-pdf"></i> PDF
                        </button>
                        <button class="btn btn-danger delete-voucher-btn">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="voucher-info">
                    <div class="voucher-info-item">
                        <div class="voucher-info-label">Agente Responsável</div>
                        <div class="voucher-info-value">${agentName}</div>
                    </div>
                    <div class="voucher-info-item">
                        <div class="voucher-info-label">Destinos</div>
                        <div class="voucher-info-value">${destinations}</div>
                    </div>
                    <div class="voucher-info-item">
                        <div class="voucher-info-label">Passageiros</div>
                        <div class="voucher-info-value">${totalPassengers}</div>
                    </div>
                    <div class="voucher-info-item">
                        <div class="voucher-info-label">Total</div>
                        <div class="voucher-info-value">R$ ${voucher.totalAmount.toFixed(2)}</div>
                    </div>
                    <div class="voucher-info-item">
                        <div class="voucher-info-label">Falta Pagar</div>
                        <div class="voucher-info-value">R$ ${voucher.remainingAmount.toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // CRUD de Vouchers
    getAllVouchers() {
        const vouchers = localStorage.getItem('vouchers');
        return vouchers ? JSON.parse(vouchers) : [];
    }

    saveVoucher() {
        const voucherData = this.getVoucherFormData();
        
        if (!this.validateVoucherData(voucherData)) {
            return;
        }
        
        // Salvar dados para autocompletar
        this.saveAutocompleteData(voucherData);
        
        const vouchers = this.getAllVouchers();
        
        if (this.editingVoucherId) {
            // Editar voucher existente
            const index = vouchers.findIndex(v => String(v.id) === String(this.editingVoucherId));
            if (index !== -1) {
                vouchers[index] = { ...voucherData, id: this.editingVoucherId, updatedAt: new Date().toISOString() };
            }
        } else {
            // Criar novo voucher
            voucherData.id = this.generateId();
            voucherData.createdAt = new Date().toISOString();
            vouchers.push(voucherData);
        }
        
        localStorage.setItem('vouchers', JSON.stringify(vouchers));
        
        this.showSuccessMessage('Voucher salvo com sucesso!');
        setTimeout(() => this.showVouchersListScreen(), 1500);
    }

    getVoucherFormData() {
        // Coletar destinos
        const destinations = [];
        document.querySelectorAll('.destination-row').forEach(row => {
            const destination = row.querySelector('input[name="destination"]').value;
            const dateInput = row.querySelector('input[name="date"]').value;
            const time = row.querySelector('input[name="time"]').value;
            
            // Converter data de YYYY-MM-DD para DD-MM-YYYY
            const date = dateInput ? this.formatDateDDMMYY(dateInput) : '';
            
            if (destination) {
                destinations.push({ destination, date, time });
            }
        });
        
        // Coletar passageiros
        const passengers = [];
        document.querySelectorAll('.passenger-row input[name="passenger"]').forEach(input => {
            if (input.value) {
                passengers.push(input.value);
            }
        });
        
        return {
            id: this.currentVoucherId || this.generateId(),
            selectedAgency: document.getElementById('selected-agency').value,
            selectedTemplate: document.getElementById('selected-template').value,
            destinations,
            boardingLocation: document.getElementById('boarding-location').value,

            passengers,
            adults: parseInt(document.getElementById('adults').value) || 0,
            children: parseInt(document.getElementById('children').value) || 0,
            infants: parseInt(document.getElementById('infants').value) || 0,
            totalPassengers: parseInt(document.getElementById('total-passengers').value) || 0,
            totalAmount: parseFloat(document.getElementById('total-amount').value) || 0,
            preBooking: parseFloat(document.getElementById('pre-booking').value) || 0,
            remainingAmount: parseFloat(document.getElementById('remaining-amount').value) || 0,
            observations: document.getElementById('observations').value,
            contractDate: this.formatDateDDMMYY(document.getElementById('contract-date').value),
            contractorName: document.getElementById('contractor-name').value,
            contractorCpf: document.getElementById('contractor-cpf').value,
            contractorPhone1: document.getElementById('contractor-phone1').value,
            contractorPhone2: document.getElementById('contractor-phone2').value,
            contractorEmail: document.getElementById('contractor-email').value
        };
    }

    validateVoucherData(data) {
        if (!data.selectedAgency) {
            this.showErrorMessage('Selecione uma agência!');
            return false;
        }
        
        if (!data.selectedTemplate) {
            this.showErrorMessage('Selecione um template!');
            return false;
        }
        
        if (!data.contractorName) {
            this.showErrorMessage('Nome do contratante é obrigatório!');
            return false;
        }
        
        if (!data.contractorPhone1) {
            this.showErrorMessage('Pelo menos um telefone do contratante é obrigatório!');
            return false;
        }
        
        if (data.destinations.length === 0) {
            this.showErrorMessage('Pelo menos um destino deve ser informado!');
            return false;
        }
        
        return true;
    }

    loadVoucherForEdit(voucherId) {
        const vouchers = this.getAllVouchers();
        const voucher = vouchers.find(v => String(v.id) === String(voucherId));
        
        if (!voucher) {
            console.error('Voucher not found with ID:', voucherId);
            return;
        }
        
        // Carregar agente responsável
        if (voucher.responsibleAgent) {
            document.getElementById('responsible-agent').value = voucher.responsibleAgent;
        }
        
        // Carregar destinos
        this.clearDestinations();
        
        if (voucher.destinations && voucher.destinations.length > 0) {
            voucher.destinations.forEach((dest, index) => {
                this.addDestination();
                
                const rows = document.querySelectorAll('.destination-row');
                const row = rows[index];
                
                if (row) {
                    const destInput = row.querySelector('input[name="destination"]');
                    const dateInput = row.querySelector('input[name="date"]');
                    const timeInput = row.querySelector('input[name="time"]');
                    
                    if (destInput) destInput.value = dest.destination || '';
                    if (dateInput) dateInput.value = this.convertDateToISO(dest.date) || '';
                    if (timeInput) timeInput.value = dest.time || '';
                }
            });
        } else {
            this.addDestination();
        }
        
        // Carregar passageiros
        this.clearPassengers();
        if (voucher.passengers && voucher.passengers.length > 0) {
            voucher.passengers.forEach((passenger, index) => {
                this.addPassenger();
                const inputs = document.querySelectorAll('.passenger-row input[name="passenger"]');
                if (inputs[index]) inputs[index].value = passenger;
            });
        } else {
            this.addPassenger();
        }
        
        // Carregar outros dados
        document.getElementById('boarding-location').value = voucher.boardingLocation || '';

        document.getElementById('adults').value = voucher.adults || 0;
        document.getElementById('children').value = voucher.children || 0;
        document.getElementById('infants').value = voucher.infants || 0;
        document.getElementById('total-amount').value = voucher.totalAmount || 0;
        document.getElementById('pre-booking').value = voucher.preBooking || 0;
        document.getElementById('observations').value = voucher.observations || '';
        document.getElementById('contract-date').value = this.convertDateToISO(voucher.contractDate) || '';
        document.getElementById('contractor-name').value = voucher.contractorName || '';
        document.getElementById('contractor-cpf').value = voucher.contractorCpf || '';
        document.getElementById('contractor-phone1').value = voucher.contractorPhone1 || '';
        document.getElementById('contractor-phone2').value = voucher.contractorPhone2 || '';
        document.getElementById('contractor-email').value = voucher.contractorEmail || '';
        
        // Recalcular totais
        this.calculateTotalPassengers();
        this.calculateRemainingAmount();
    }

    deleteVoucher(voucherId) {
        if (confirm('Tem certeza que deseja excluir este voucher?')) {
            const vouchers = this.getAllVouchers();
            const filteredVouchers = vouchers.filter(v => v.id !== voucherId);
            localStorage.setItem('vouchers', JSON.stringify(filteredVouchers));
            this.loadVouchersList();
            
            // Recarregar configurações da agência para atualizar templates disponíveis
            this.loadAgencyConfig();
            
            this.showSuccessMessage('Voucher excluído com sucesso!');
        }
    }

    // Formulário de Voucher
    resetVoucherForm() {
        document.getElementById('voucher-form').reset();
        document.getElementById('contract-date').value = new Date().toISOString().split('T')[0];
        this.clearDestinations();
        this.clearPassengers();
        this.addDestination();
        this.addPassenger();
    }

    addDestination() {
        const container = document.getElementById('destinations-container');
        const destinationRow = document.createElement('div');
        destinationRow.className = 'destination-row';
        destinationRow.innerHTML = `
            <div class="form-group">
                <label>Destino</label>
                <input type="text" name="destination" class="form-input autocomplete-input" data-field="destination">
            </div>
            <div class="form-group">
                <label>Data</label>
                <input type="date" name="date" class="form-input">
            </div>
            <div class="form-group">
                <label>Horário</label>
                <input type="time" name="time" class="form-input">
            </div>
            <button type="button" class="remove-destination-btn" title="Remover">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        container.appendChild(destinationRow);
        
        // Event listener para remover
        destinationRow.querySelector('.remove-destination-btn').addEventListener('click', () => {
            if (container.children.length > 1) {
                destinationRow.remove();
            }
        });
        
        // Setup autocomplete para o novo campo
        this.setupAutocompleteForField(destinationRow.querySelector('.autocomplete-input'));
    }

    clearDestinations() {
        document.getElementById('destinations-container').innerHTML = '';
    }

    addPassenger() {
        const container = document.getElementById('passengers-container');
        const passengerCount = container.children.length + 1;
        
        const passengerRow = document.createElement('div');
        passengerRow.className = 'passenger-row';
        passengerRow.innerHTML = `
            <label>PAX ${passengerCount}</label>
            <input type="text" name="passenger" class="form-input autocomplete-input" data-field="passenger">
        `;
        
        container.appendChild(passengerRow);
        
        // Setup autocomplete para o novo campo
        this.setupAutocompleteForField(passengerRow.querySelector('.autocomplete-input'));
    }

    clearPassengers() {
        document.getElementById('passengers-container').innerHTML = '';
    }

    // Cálculos automáticos
    calculateTotalPassengers() {
        const adults = parseInt(document.getElementById('adults').value) || 0;
        const children = parseInt(document.getElementById('children').value) || 0;
        const infants = parseInt(document.getElementById('infants').value) || 0;
        
        document.getElementById('total-passengers').value = adults + children + infants;
    }

    calculateRemainingAmount() {
        const total = parseFloat(document.getElementById('total-amount').value) || 0;
        const preBooking = parseFloat(document.getElementById('pre-booking').value) || 0;
        
        document.getElementById('remaining-amount').value = (total - preBooking).toFixed(2);
    }

    setupFormCalculations() {
        // Recalcular quando os campos mudarem
        document.querySelectorAll('.passenger-count').forEach(input => {
            input.addEventListener('input', () => this.calculateTotalPassengers());
        });
        
        document.querySelectorAll('.money-input').forEach(input => {
            input.addEventListener('input', () => this.calculateRemainingAmount());
        });
    }

    // Sistema de Autocompletar
    setupAutocomplete() {
        document.querySelectorAll('.autocomplete-input').forEach(input => {
            this.setupAutocompleteForField(input);
        });
    }

    setupAutocompleteForField(input) {
        const field = input.dataset.field;
        
        input.addEventListener('input', (e) => {
            this.showAutocompleteSuggestions(e.target, field);
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => this.hideAutocompleteSuggestions(), 200);
        });
    }

    showAutocompleteSuggestions(input, field) {
        const value = input.value.toLowerCase();
        const suggestions = this.autocompleteData[field] || [];
        
        if (value.length < 2) {
            this.hideAutocompleteSuggestions();
            return;
        }
        
        const filteredSuggestions = suggestions.filter(suggestion => 
            suggestion.toLowerCase().includes(value)
        ).slice(0, 5);
        
        if (filteredSuggestions.length === 0) {
            this.hideAutocompleteSuggestions();
            return;
        }
        
        this.displayAutocompleteSuggestions(input, filteredSuggestions);
    }

    displayAutocompleteSuggestions(input, suggestions) {
        const container = document.getElementById('autocomplete-suggestions');
        const rect = input.getBoundingClientRect();
        
        container.style.left = rect.left + 'px';
        container.style.top = (rect.bottom + window.scrollY) + 'px';
        container.style.width = rect.width + 'px';
        container.style.display = 'block';
        
        container.innerHTML = suggestions.map(suggestion => 
            `<div class="autocomplete-suggestion">${suggestion}</div>`
        ).join('');
        
        // Event listeners para as sugestões
        container.querySelectorAll('.autocomplete-suggestion').forEach(suggestion => {
            suggestion.addEventListener('click', () => {
                input.value = suggestion.textContent;
                this.hideAutocompleteSuggestions();
                input.focus();
            });
        });
    }

    hideAutocompleteSuggestions() {
        document.getElementById('autocomplete-suggestions').style.display = 'none';
    }

    saveAutocompleteData(voucherData) {
        // Salvar destinos
        voucherData.destinations.forEach(dest => {
            if (dest.destination) {
                this.addToAutocomplete('destination', dest.destination);
            }
        });
        
        // Salvar outros campos
        if (voucherData.boardingLocation) {
            this.addToAutocomplete('boarding-location', voucherData.boardingLocation);
        }
        
        voucherData.passengers.forEach(passenger => {
            if (passenger) {
                this.addToAutocomplete('passenger', passenger);
            }
        });
        
        if (voucherData.observations) {
            this.addToAutocomplete('observations', voucherData.observations);
        }
        
        if (voucherData.contractorName) {
            this.addToAutocomplete('contractor-name', voucherData.contractorName);
        }
        
        if (voucherData.contractorPhone1) {
            this.addToAutocomplete('contractor-phone1', voucherData.contractorPhone1);
        }
        
        if (voucherData.contractorPhone2) {
            this.addToAutocomplete('contractor-phone2', voucherData.contractorPhone2);
        }
        
        if (voucherData.contractorEmail) {
            this.addToAutocomplete('contractor-email', voucherData.contractorEmail);
        }
        
        localStorage.setItem('autocompleteData', JSON.stringify(this.autocompleteData));
    }

    addToAutocomplete(field, value) {
        if (!this.autocompleteData[field]) {
            this.autocompleteData[field] = [];
        }
        
        if (!this.autocompleteData[field].includes(value)) {
            this.autocompleteData[field].push(value);
            
            // Limitar a 50 sugestões por campo
            if (this.autocompleteData[field].length > 50) {
                this.autocompleteData[field] = this.autocompleteData[field].slice(-50);
            }
        }
    }

    loadAutocompleteData() {
        const data = localStorage.getItem('autocompleteData');
        return data ? JSON.parse(data) : {};
    }

    // Geração de PDF
    async generatePDF() {
        const voucherData = this.getVoucherFormData();
        const agencyConfig = this.getAgencyConfig();
        
        if (!this.validateVoucherData(voucherData)) {
            return;
        }
        
        await this.createPDF(voucherData, agencyConfig);
    }

    async generatePDFFromVoucher(voucherId) {
        const vouchers = this.getAllVouchers();
        const voucher = vouchers.find(v => v.id === voucherId);
        const agencyConfig = this.getAgencyConfig();
        
        if (voucher && agencyConfig) {
            await this.createPDF(voucher, agencyConfig);
        }
    }

    async createPDF(voucherData, agencyConfig) {
        try {
            const { PDFDocument } = PDFLib; // Garante que PDFDocument está disponível

            // 1. DEFINIR NOME DO ARQUIVO (sem caracteres especiais, exceto _)
            const safeContractorName = voucherData.contractorName.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `voucher_${safeContractorName}_${new Date().toISOString().split('T')[0]}.pdf`;

            // 2. CARREGAR O TEMPLATE
            const templateBytes = await this.loadSelectedTemplate(voucherData.selectedTemplate);
            if (!templateBytes) {
                this.showErrorMessage('Template PDF não encontrado. Carregue um na tela de configuração.');
                return;
            }

            // 3. PREENCHER O PDF
            const pdfDoc = await PDFDocument.load(templateBytes);
            const form = pdfDoc.getForm();
            this.fillPDFFields(form, voucherData, agencyConfig);

            // 4. "ACHATAR" (FLATTEN) O FORMULÁRIO
            // Esta é a melhor prática para máxima compatibilidade. Torna os campos não-editáveis.
            form.flatten();

            // 5. SALVAR OS BYTES DO PDF FINAL
            const pdfBytes = await pdfDoc.save();

            // 6. CRIAR O BLOB COM O MIME TYPE CORRETO
            // Este é o passo crucial que diz ao navegador/celular que este é um arquivo PDF.
            const blob = new Blob([pdfBytes], {
                type: 'application/pdf'
            });

            // 7. LÓGICA DE COMPARTILHAMENTO E DOWNLOAD (MAIS ROBUSTA)
            // A API de compartilhamento é a melhor opção para celulares.
            if (navigator.share) {
                try {
                    // Criamos um objeto File, que é o formato ideal para a API de compartilhamento
                    const file = new File([blob], fileName, { type: 'application/pdf' });
                    
                    // Verificamos se o navegador pode compartilhar este tipo de arquivo
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Voucher de Viagem',
                            text: `Segue o voucher para ${voucherData.contractorName}.`
                        });
                        this.showSuccessMessage('Voucher compartilhado!');
                        return; // Encerra a função após o sucesso
                    }
                } catch (error) {
                    console.warn('Compartilhamento nativo falhou, tentando download...', error);
                    // Se o compartilhamento falhar (ex: usuário cancelou), o código continua para o método de download.
                }
            }
            
            // Se a API de compartilhamento não estiver disponível ou falhar, usamos o download tradicional.
            // Este método é um "truque" padrão para forçar o download no navegador.
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            
            // Adiciona ao corpo do documento, clica e remove.
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Limpa a URL do objeto para liberar memória.
            URL.revokeObjectURL(link.href);
            this.showSuccessMessage('PDF baixado com sucesso!');

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            this.showErrorMessage('Erro ao gerar PDF: ' + error.message);
        }
    }
    
    downloadFile(blob, fileName) {
        // Função auxiliar para download tradicional com máxima compatibilidade mobile
        // Solução específica para problema do WhatsApp com MIME type
        
        // Garantir que o fileName tenha extensão .pdf
        let finalFileName = fileName;
        if (!finalFileName.toLowerCase().endsWith('.pdf')) {
            finalFileName += '.pdf';
        }
        
        // Detectar se está sendo executado em contexto que pode ser compartilhado via WhatsApp
        const isLikelyMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isWhatsAppContext = /WhatsApp/i.test(navigator.userAgent) || window.location.href.includes('whatsapp');
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        // Configurar atributos essenciais para compatibilidade
        a.href = url;
        a.download = finalFileName;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.display = 'none';
        
        // Atributos críticos para reconhecimento do tipo de arquivo
        a.setAttribute('type', 'application/pdf');
        a.setAttribute('data-downloadurl', `application/pdf:${finalFileName}:${url}`);
        
        // Simular Content-Disposition header através de atributos
        a.setAttribute('data-content-disposition', `attachment; filename="${finalFileName}"`);
        a.setAttribute('data-content-type', 'application/pdf');
        
        // Atributos específicos para melhor reconhecimento em contextos móveis/WhatsApp
        if (isLikelyMobile || isWhatsAppContext) {
            // Headers HTTP simulados para máxima compatibilidade
            a.setAttribute('data-mime-type', 'application/pdf');
            a.setAttribute('data-file-extension', '.pdf');
            a.setAttribute('data-content-encoding', 'binary');
            a.setAttribute('data-content-length', blob.size.toString());
            
            // Atributos específicos para WhatsApp
            a.setAttribute('data-whatsapp-type', 'document');
            a.setAttribute('data-whatsapp-mime', 'application/pdf');
            
            // Forçar reconhecimento como documento PDF
            a.setAttribute('data-document-type', 'pdf');
            a.setAttribute('data-file-category', 'document');
        }
        
        document.body.appendChild(a);
        
        // Múltiplas tentativas de clique para máxima compatibilidade
        let clickSuccess = false;
        
        try {
            // Tentativa 1: Click direto
            a.click();
            clickSuccess = true;
        } catch (clickError) {
            console.log('Click direto falhou, tentando evento personalizado');
            
            try {
                // Tentativa 2: Evento MouseEvent
                const event = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    button: 0
                });
                a.dispatchEvent(event);
                clickSuccess = true;
            } catch (eventError) {
                console.log('Evento MouseEvent falhou, tentando focus + enter');
                
                try {
                    // Tentativa 3: Focus + Enter (para alguns navegadores mobile)
                    a.focus();
                    const enterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true
                    });
                    a.dispatchEvent(enterEvent);
                    clickSuccess = true;
                } catch (focusError) {
                    console.error('Todas as tentativas de download falharam:', focusError);
                }
            }
        }
        
        // Remover elemento após um pequeno delay
        setTimeout(() => {
            if (document.body.contains(a)) {
                document.body.removeChild(a);
            }
        }, 100);
        
        // Limpar URL após tempo suficiente para o download
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 10000);
        
        return clickSuccess;
    }
    
    async loadSelectedTemplate(templateId) {
        if (!templateId) return null;
        
        try {
            const [agencyId, templateIndex] = templateId.split('-');
            const agencies = this.getAllAgencies();
            const agency = agencies.find(a => a.id === agencyId);
            
            if (agency && agency.templates && agency.templates[templateIndex]) {
                // Criar uma nova instância do array para evitar referências de memória
                const templateData = agency.templates[templateIndex].data;
                if (templateData && Array.isArray(templateData)) {
                    return new Uint8Array([...templateData]);
                }
            }
            
            console.warn('Template não encontrado:', templateId);
            return null;
        } catch (error) {
            console.error('Erro ao carregar template:', error);
            return null;
        }
    }
    
    getSelectedAgencyData(agencyId) {
        const agencies = this.getAllAgencies();
        const agency = agencies.find(a => a.id === agencyId);
        
        if (agency) {
            return {
                name: agency.name,
                // Manter compatibilidade com campos antigos
                address: '',
                cnpj: '',
                phone1: '',
                phone2: '',
                contract: ''
            };
        }
        
        return this.getAgencyConfig() || {};
    }
    
    async loadPDFTemplate() {
        return new Promise((resolve, reject) => {
            // Criar input de arquivo
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf';
            input.style.display = 'none';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file && file.type === 'application/pdf') {
                    try {
                        const arrayBuffer = await file.arrayBuffer();
                        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                        localStorage.setItem('pdfTemplate', base64);
                        this.showSuccessMessage('Template PDF carregado com sucesso!');
                        resolve();
                    } catch (error) {
                        this.showErrorMessage('Erro ao carregar template PDF.');
                        reject(error);
                    }
                } else {
                    this.showErrorMessage('Por favor, selecione um arquivo PDF válido.');
                    reject(new Error('Arquivo inválido'));
                }
                document.body.removeChild(input);
            };
            
            input.oncancel = () => {
                document.body.removeChild(input);
                reject(new Error('Seleção cancelada'));
            };
            
            document.body.appendChild(input);
            input.click();
            
            // Mostrar mensagem para o usuário
            this.showMessage('Por favor, selecione o arquivo voucher_cviagens.pdf', 'info');
        });
    }

    createVoucherPage(doc, voucherData, agencyConfig, pageWidth, pageHeight, margin) {
        let yPos = margin;
        
        // Fundo gradiente azul no cabeçalho
        doc.setFillColor(41, 128, 185); // Azul principal
        doc.rect(0, 0, pageWidth, 45, 'F');
        
        // Fundo gradiente mais claro
        doc.setFillColor(52, 152, 219); // Azul mais claro
        doc.rect(0, 0, pageWidth, 35, 'F');
        
        // Logo da agência à esquerda (com fundo branco)
        if (agencyConfig.agencyLogo) {
            try {
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(margin - 2, yPos - 2, 34, 24, 3, 3, 'F');
                // Detectar formato da imagem
                const format = agencyConfig.agencyLogo.includes('data:image/png') ? 'PNG' : 
                              agencyConfig.agencyLogo.includes('data:image/jpeg') ? 'JPEG' : 'PNG';
                doc.addImage(agencyConfig.agencyLogo, format, margin, yPos, 30, 20);
            } catch (e) {
                console.log('Erro ao adicionar logo da agência:', e);
                // Fallback: desenhar um retângulo com texto
                doc.setFillColor(41, 128, 185);
                doc.roundedRect(margin, yPos, 30, 20, 3, 3, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.text('LOGO', margin + 15, yPos + 12, { align: 'center' });
                doc.setTextColor(0, 0, 0);
            }
        }
        
        // Logo do Cadastur à direita (com fundo branco)
        if (agencyConfig.cadasturLogo) {
            try {
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(pageWidth - margin - 32, yPos - 2, 34, 24, 3, 3, 'F');
                // Detectar formato da imagem
                const format = agencyConfig.cadasturLogo.includes('data:image/png') ? 'PNG' : 
                              agencyConfig.cadasturLogo.includes('data:image/jpeg') ? 'JPEG' : 'PNG';
                doc.addImage(agencyConfig.cadasturLogo, format, pageWidth - margin - 30, yPos, 30, 20);
            } catch (e) {
                console.log('Erro ao adicionar logo do Cadastur:', e);
                // Fallback: desenhar um retângulo com texto
                doc.setFillColor(46, 204, 113);
                doc.roundedRect(pageWidth - margin - 30, yPos, 30, 20, 3, 3, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.text('CADASTUR', pageWidth - margin - 15, yPos + 12, { align: 'center' });
                doc.setTextColor(0, 0, 0);
            }
        }
        
        // Informações da agência centralizadas (texto branco)
        doc.setTextColor(255, 255, 255); // Texto branco
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(agencyConfig.name, pageWidth / 2, yPos + 10, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(agencyConfig.address, pageWidth / 2, yPos + 18, { align: 'center' });
        doc.text(`CNPJ: ${agencyConfig.cnpj}`, pageWidth / 2, yPos + 25, { align: 'center' });
        
        // Resetar cor do texto para preto
        doc.setTextColor(0, 0, 0);
        
        yPos += 50;
        
        // Seção de destinos com fundo colorido
        doc.setFillColor(236, 240, 241); // Cinza claro
        doc.roundedRect(margin, yPos - 5, pageWidth - 2 * margin, 25, 3, 3, 'F');
        
        // Cabeçalho da tabela de destinos
        doc.setTextColor(44, 62, 80); // Azul escuro
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('DESTINOS', margin + 5, yPos + 5);
        doc.text('DATA', pageWidth / 2, yPos + 5, { align: 'center' });
        doc.text('HORÁRIO', pageWidth - margin - 25, yPos + 5, { align: 'right' });
        yPos += 15;
        
        // Linha separadora colorida
        doc.setDrawColor(52, 152, 219); // Azul
        doc.setLineWidth(1);
        doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos);
        yPos += 8;
        
        // Dados dos destinos
        doc.setTextColor(0, 0, 0); // Preto
        doc.setFont(undefined, 'normal');
        voucherData.destinations.forEach((dest, index) => {
            if (index < 7) { // Máximo 7 destinos na primeira página
                // Fundo alternado para as linhas
                if (index % 2 === 0) {
                    doc.setFillColor(249, 249, 249);
                    doc.rect(margin, yPos - 3, pageWidth - 2 * margin, 8, 'F');
                }
                
                doc.text(dest.destination || '', margin + 5, yPos);
                doc.text(dest.date || '', pageWidth / 2, yPos, { align: 'center' });
                doc.text(dest.time || '', pageWidth - margin - 25, yPos, { align: 'right' });
                yPos += 8;
            }
        });
        
        yPos += 15;
        
        // Seção Local de Embarque com design colorido
        doc.setFillColor(46, 204, 113); // Verde
        doc.roundedRect(margin, yPos - 3, pageWidth - 2 * margin, 18, 3, 3, 'F');
        
        doc.setTextColor(255, 255, 255); // Texto branco
        doc.setFont(undefined, 'bold');
        doc.text('LOCAL DE EMBARQUE:', margin + 5, yPos + 5);
        doc.setFont(undefined, 'normal');
        doc.text(voucherData.boardingLocation || '', margin + 5, yPos + 12);
        
        yPos += 25;
        
        // Seção Passageiros com design colorido
        doc.setFillColor(155, 89, 182); // Roxo
        doc.roundedRect(margin, yPos - 3, pageWidth - 2 * margin, 15, 3, 3, 'F');
        
        doc.setTextColor(255, 255, 255); // Texto branco
        doc.setFont(undefined, 'bold');
        doc.text('PASSAGEIROS:', margin + 5, yPos + 8);
        
        yPos += 20;
        
        // Lista de passageiros com fundo alternado
        doc.setTextColor(0, 0, 0); // Preto
        doc.setFont(undefined, 'normal');
        voucherData.passengers.forEach((passenger, index) => {
            if (passenger) {
                // Fundo alternado
                if (index % 2 === 0) {
                    doc.setFillColor(249, 249, 249);
                    doc.rect(margin, yPos - 3, pageWidth - 2 * margin, 8, 'F');
                }
                doc.text(`PAX ${index + 1}: ${passenger}`, margin + 5, yPos);
                yPos += 8;
            }
        });
        
        yPos += 15;
        
        // Seção Quantidade de Passageiros com design em tabela colorida
        doc.setFillColor(52, 152, 219); // Azul
        doc.roundedRect(margin, yPos - 3, pageWidth - 2 * margin, 25, 3, 3, 'F');
        
        // Cabeçalhos da tabela
        doc.setTextColor(255, 255, 255); // Texto branco
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('ADULTOS', margin + 15, yPos + 8, { align: 'center' });
        doc.text('CRIANÇAS 4-9', margin + 65, yPos + 8, { align: 'center' });
        doc.text('COLOS', margin + 115, yPos + 8, { align: 'center' });
        doc.text('TOTAL', margin + 155, yPos + 8, { align: 'center' });
        
        yPos += 15;
        
        // Fundo branco para os valores
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, yPos - 3, pageWidth - 2 * margin, 15, 3, 3, 'F');
        
        // Valores dos passageiros
        doc.setTextColor(44, 62, 80); // Azul escuro
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(voucherData.adults.toString(), margin + 15, yPos + 8, { align: 'center' });
        doc.text(voucherData.children.toString(), margin + 65, yPos + 8, { align: 'center' });
        doc.text(voucherData.infants.toString(), margin + 115, yPos + 8, { align: 'center' });
        doc.text(voucherData.totalPassengers.toString(), margin + 155, yPos + 8, { align: 'center' });
        
        yPos += 25;
        
        // Seção Valores com design em tabela colorida
        doc.setFillColor(231, 76, 60); // Vermelho
        doc.roundedRect(margin, yPos - 3, pageWidth - 2 * margin, 25, 3, 3, 'F');
        
        // Cabeçalhos dos valores
        doc.setTextColor(255, 255, 255); // Texto branco
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL A PAGAR', margin + 35, yPos + 8, { align: 'center' });
        doc.text('PRÉ RESERVA', margin + 105, yPos + 8, { align: 'center' });
        doc.text('FALTA PAGAR', margin + 165, yPos + 8, { align: 'center' });
        
        yPos += 15;
        
        // Fundo branco para os valores monetários
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, yPos - 3, pageWidth - 2 * margin, 15, 3, 3, 'F');
        
        // Valores monetários
        doc.setTextColor(44, 62, 80); // Azul escuro
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`R$ ${voucherData.totalAmount.toFixed(2)}`, margin + 35, yPos + 8, { align: 'center' });
        doc.text(`R$ ${voucherData.preBooking.toFixed(2)}`, margin + 105, yPos + 8, { align: 'center' });
        doc.text(`R$ ${voucherData.remainingAmount.toFixed(2)}`, margin + 165, yPos + 8, { align: 'center' });
        
        yPos += 25;
        
        // Seção Observações com design colorido
        if (voucherData.observations) {
            // Cabeçalho das observações
            doc.setFillColor(243, 156, 18); // Laranja
            doc.roundedRect(margin, yPos - 3, pageWidth - 2 * margin, 15, 3, 3, 'F');
            
            doc.setTextColor(255, 255, 255); // Texto branco
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('OBSERVAÇÕES:', margin + 5, yPos + 8);
            
            yPos += 20;
            
            // Fundo para o conteúdo das observações
            const observationHeight = Math.max(20, doc.splitTextToSize(voucherData.observations, pageWidth - 2 * margin - 10).length * 6 + 10);
            doc.setFillColor(254, 249, 231); // Amarelo claro
            doc.roundedRect(margin, yPos - 5, pageWidth - 2 * margin, observationHeight, 3, 3, 'F');
            
            // Borda colorida
            doc.setDrawColor(243, 156, 18); // Laranja
            doc.setLineWidth(1);
            doc.roundedRect(margin, yPos - 5, pageWidth - 2 * margin, observationHeight, 3, 3, 'S');
            
            // Texto das observações
            doc.setTextColor(44, 62, 80); // Azul escuro
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const splitObservations = doc.splitTextToSize(voucherData.observations, pageWidth - 2 * margin - 10);
            doc.text(splitObservations, margin + 5, yPos + 2);
        }
    }

    createContractPage(doc, voucherData, agencyConfig, pageWidth, pageHeight, margin) {
        let yPos = margin;
        
        // Título do contrato
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', pageWidth / 2, yPos, { align: 'center' });
        yPos += 20;
        
        // Conteúdo do contrato
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const contractText = doc.splitTextToSize(agencyConfig.contract, pageWidth - 2 * margin);
        doc.text(contractText, margin, yPos);
        
        // Dados do contratante no final
        yPos = pageHeight - 60;
        
        doc.setFont(undefined, 'bold');
        doc.text('DADOS DO CONTRATANTE:', margin, yPos);
        yPos += 10;
        
        doc.setFont(undefined, 'normal');
        doc.text(`Data do Contrato: ${voucherData.contractDate || ''}`, margin, yPos);
        yPos += 6;
        doc.text(`Nome: ${voucherData.contractorName}`, margin, yPos);
        yPos += 6;
        if (voucherData.contractorCpf) {
            doc.text(`CPF: ${voucherData.contractorCpf}`, margin, yPos);
            yPos += 6;
        }
        doc.text(`Telefone: ${voucherData.contractorPhone1}${voucherData.contractorPhone2 ? ' / ' + voucherData.contractorPhone2 : ''}`, margin, yPos);
        yPos += 6;
        if (voucherData.contractorEmail) {
            doc.text(`E-mail: ${voucherData.contractorEmail}`, margin, yPos);
        }
    }

    // Utilitários
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // Gerenciamento de Agentes
    addAgent(isAdmin = false) {
        const agentId = this.generateId();
        const agentsContainer = document.getElementById('agents-container');
        
        const agentCard = document.createElement('div');
        agentCard.className = 'agent-card';
        agentCard.dataset.agentId = agentId;
        
        agentCard.innerHTML = `
            <div class="agent-header">
                <h4>
                    <i class="fas fa-user"></i>
                    ${isAdmin ? 'Administrador' : 'Agente de Viagem'}
                </h4>
                ${!isAdmin ? `<div class="agent-actions">
                    <button type="button" class="edit-agent-btn" onclick="voucherSystem.editAgent('${agentId}')" title="Editar agente">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="remove-agent-btn" onclick="voucherSystem.removeAgent('${agentId}')" title="Remover agente">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>` : ''}
            </div>
            <div class="agent-form">
                <div class="form-group">
                    <label>Nome Completo *</label>
                    <input type="text" name="agent-name" class="form-input" required ${isAdmin ? 'placeholder="Nome do Administrador"' : 'placeholder="Nome do Agente"'}>
                </div>
                <div class="form-group">
                    <label>Email *</label>
                    <input type="email" name="agent-email" class="form-input" required placeholder="email@exemplo.com">
                </div>
                <div class="form-group">
                    <label>Telefone</label>
                    <input type="tel" name="agent-phone" class="form-input" placeholder="(85) 99999-9999">
                </div>
                <div class="form-group">
                    <label>Tipo</label>
                    <select name="agent-type" class="form-select" ${isAdmin ? 'disabled' : ''}>
                        <option value="admin" ${isAdmin ? 'selected' : ''}>Administrador</option>
                        <option value="agent" ${!isAdmin ? 'selected' : ''}>Agente</option>
                    </select>
                </div>
            </div>
        `;
        
        agentsContainer.appendChild(agentCard);
        
        // Adicionar máscara de telefone
        const phoneInput = agentCard.querySelector('input[name="agent-phone"]');
        phoneInput.addEventListener('input', (e) => {
            e.target.value = this.maskPhone(e.target.value);
        });
    }
    
    removeAgent(agentId) {
        if (confirm('Tem certeza que deseja remover este agente?')) {
            const agentCard = document.querySelector(`[data-agent-id="${agentId}"]`);
            if (agentCard) {
                agentCard.remove();
                // Salvar mudanças no localStorage
                const agentsData = this.getAgentsData();
                const agencyConfig = this.getAgencyConfig();
                agencyConfig.agents = agentsData;
                localStorage.setItem('agencyConfig', JSON.stringify(agencyConfig));
                this.showSuccessMessage('Agente removido com sucesso!');
            }
        }
    }

    editAgent(agentId) {
        const agentCard = document.querySelector(`[data-agent-id="${agentId}"]`);
        if (agentCard) {
            const nameSpan = agentCard.querySelector('.agent-name');
            const currentName = nameSpan.textContent;
            const newName = prompt('Digite o novo nome do agente:', currentName);
            
            if (newName && newName.trim() !== '' && newName !== currentName) {
                nameSpan.textContent = newName.trim();
                // Salvar mudanças no localStorage
                const agentsData = this.getAgentsData();
                const agencyConfig = this.getAgencyConfig();
                agencyConfig.agents = agentsData;
                localStorage.setItem('agencyConfig', JSON.stringify(agencyConfig));
                this.loadAgentOptions(); // Atualizar opções no formulário
                this.showSuccessMessage('Agente editado com sucesso!');
            }
        }
    }
    
    getAgentsData() {
        const agents = [];
        const agentCards = document.querySelectorAll('.agent-card');
        
        agentCards.forEach(card => {
            const agentId = card.dataset.agentId;
            const name = card.querySelector('input[name="agent-name"]').value;
            const email = card.querySelector('input[name="agent-email"]').value;
            const phone = card.querySelector('input[name="agent-phone"]').value;
            const type = card.querySelector('select[name="agent-type"]').value;
            
            if (name && email) {
                agents.push({
                    id: agentId,
                    name: name,
                    email: email,
                    phone: phone,
                    type: type
                });
            }
        });
        
        return agents;
    }
    
    loadAgents(agents) {
        const agentsContainer = document.getElementById('agents-container');
        agentsContainer.innerHTML = '';
        
        agents.forEach(agent => {
            this.addAgent(agent.type === 'admin');
            const lastCard = agentsContainer.lastElementChild;
            lastCard.dataset.agentId = agent.id;
            lastCard.querySelector('input[name="agent-name"]').value = agent.name;
            lastCard.querySelector('input[name="agent-email"]').value = agent.email;
            lastCard.querySelector('input[name="agent-phone"]').value = agent.phone;
            lastCard.querySelector('select[name="agent-type"]').value = agent.type;
        });
    }
    
    loadAgentOptions() {
        const config = this.getAgencyConfig();
        const agentSelect = document.getElementById('responsible-agent');
        
        if (!agentSelect || !config || !config.agents) return;
        
        // Limpar opções existentes (exceto a primeira)
        while (agentSelect.children.length > 1) {
            agentSelect.removeChild(agentSelect.lastChild);
        }
        
        // Adicionar opções dos agentes
        config.agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id;
            option.textContent = `${agent.name} (${agent.type === 'admin' ? 'Administrador' : 'Agente'})`;
            agentSelect.appendChild(option);
        });
    }

    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type) {
        // Criar elemento de mensagem
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;
        
        // Estilos inline
        Object.assign(messageEl.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            color: 'white',
            fontWeight: '600',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minWidth: '300px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            background: type === 'success' ? '#10b981' : '#ef4444',
            animation: 'slideIn 0.5s ease-out'
        });
        
        document.body.appendChild(messageEl);
        
        // Remover após 3 segundos
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.5s ease-in';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 500);
        }, 3000);
    }
}

// Inicializar aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    new VoucherSystem();
});

// Adicionar estilos CSS para animações de mensagem
const messageStyles = document.createElement('style');
messageStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(messageStyles);
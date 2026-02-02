## The Two-Level Pattern                                                                                                                                                                    
                                                                                                                                                                                           
  Level 1: Approval Time (Fan-Out)                                                                                                                                                         
                                                                                                                                                                                           
  Human clicks APPROVE once → All 9 items get status = 'approved' simultaneously                                                                                                           
                                                                                                                                                                                           
  -- This happens immediately when campaign.approved fires                                                                                                                                 
  UPDATE campaign_items                                                                                                                                                                    
  SET status = 'approved'                                                                                                                                                                  
  WHERE campaign_id = 'abc123';                                                                                                                                                            
  -- All 9 rows updated in one transaction                                                                                                                                                 
                                                                                                                                                                                           
  Level 2: Execution Time (Per-Item Check)                                                                                                                                                 
                                                                                                                                                                                           
  When it's time to send email N, the function checks that item's status:                                                                                                                  
                                                                                                                                                                                           
  // send-reach-out-initial function (simplified)                                                                                                                                          
  async function sendEmail(campaignId: string, sequence: number) {                                                                                                                         
    const item = await db.campaign_items                                                                                                                                                   
      .where({ campaign_id: campaignId, sequence })                                                                                                                                        
      .single();                                                                                                                                                                           
                                                                                                                                                                                           
    // Gate check - item MUST be approved                                                                                                                                                  
    if (item.status !== 'approved') {                                                                                                                                                      
      throw new Error('Cannot send unapproved item');                                                                                                                                      
    }                                                                                                                                                                                      
                                                                                                                                                                                           
    // Send via Resend                                                                                                                                                                     
    await resend.send({ to: lead.email, subject: item.subject, body: item.body });                                                                                                         
                                                                                                                                                                                           
    // Update status                                                                                                                                                                       
    await db.campaign_items.update(item.id, { status: 'sent', sent_at: now() });                                                                                                           
  }                                                                                                                                                                                        
                                                                                                                                                                                           
  ---                                                                                                                                                                                      
  Why Both Levels?                                                                                                                                                                         
                                                                                                                                                                                           
  The execution-time check is a safety gate, not a human decision point:                                                                                                                   
  ┌──────────────────────────────┬────────────────────────────────────────────────────────────────────────┐                                                                                
  │           Scenario           │                              What Happens                              │                                                                                
  ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤                                                                                
  │ Happy path                   │ Item is approved (from fan-out) → sends normally                       │                                                                                
  ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤                                                                                
  │ Bug/race condition           │ Item somehow not approved → function throws error, doesn't send        │                                                                                
  ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤                                                                                
  │ Campaign canceled mid-flight │ Items stay approved but campaign status prevents new sends             │                                                                                
  ├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤                                                                                
  │ System restart               │ Can resume safely - only send items that are approved but not yet sent │                                                                                
  └──────────────────────────────┴────────────────────────────────────────────────────────────────────────┘                                                                                
  ---                                                                                                                                                                                      
  Status Progression                                                                                                                                                                       
                                                                                                                                                                                           
                      APPROVAL TIME                    EXECUTION TIME                                                                                                                      
                      ─────────────                    ──────────────                                                                                                                      
                            │                               │                                                                                                                              
  Item 1: pending ──────────┼── approved ──────────────────┼── sent                                                                                                                        
  Item 2: pending ──────────┼── approved                   │   (waiting)                                                                                                                   
  Item 3: pending ──────────┼── approved                   │   (waiting)                                                                                                                   
  ...                       │                               │                                                                                                                              
  Item 9: pending ──────────┼── approved                   │   (waiting)                                                                                                                   
                            │                               │                                                                                                                              
                      Human clicks                    Function checks                                                                                                                      
                      APPROVE (once)                  before each send                                                                                                                     
                                                                                                                                                                                           
  ---                                                                                                                                                                                      
  So to directly answer your question:                                                                                                                                                     
                                                                                                                                                                                           
  Yes - every individual email is gated at execution time. The send function checks item.status === 'approved' before sending.                                                             
                                                                                                                                                                                           
  But - in normal operation, all items are already approved from the fan-out, so this check always passes. It's a defensive pattern, not a human decision point.                           
                                                                                                                                                                                           
  The human sees: "Approve campaign"                                                                                                                                                       
  The system does: Mark 9 items approved, then each item checks its own status before executing                                                                                            
                                                                                                                                                                                           
  This pattern means:                                                                                                                                                                      
  - Events stay flat and independent (each item has its own status)                                                                                                                        
  - Humans get a single touchpoint (bundle approval)                                                                                                                                       
  - The system is robust (execution-time checks prevent bugs from sending unapproved content)  
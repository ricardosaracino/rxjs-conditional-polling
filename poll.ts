public subscribeSocketMessages(): void {

    let token;

    this.store.pipe(select(fromStore.getAuthToken), take(1)).subscribe(t => (token = t));

    const subject = new Subject();

    let started = false;

    this.websocket.connectToUserChannel(token).pipe(
      
      filter(d => d?.service === 'ReportDistribution' && d?.details?.type === 'System' && d?.details?.id == this.systemDistributionId),

      tap((data) => {

        if (data.event === 'ReportDistributionError') {
          this.releasing = false;
          this.snack.showErrorMessage(data.details?.error);
        }

        if (data.event === 'ReportDistributionStart') {
          this.releasing = true;
          this.progress = 0;
        }

        if (data.event === 'ReportSent') {
          this.releasing = true;
          this.progress = 100 * (data.details.currentCount / data.details.total);
        }

        if (data.event === 'ReportDistributionEnd') {
          // set releasing to false in the one last refresh timer
        }
      }),

      filter(data => {
        
        if (data.event === 'ReportDistributionStart') {
          started = true;
          return true;
        }

        // Page refresh we will never see ReportDistributionStart
        if (data.event === 'ReportSent' && !started) {
          started = true;
          return true;
        }

        return data.event === 'ReportDistributionEnd';
      }),

      switchMap(data => {

        if (data.event === 'ReportDistributionEnd') {
          
          subject.next(data.event === 'ReportDistributionEnd');

          // Need one last refresh to get the "Pending" updated
          return interval(4000).pipe(take(1), tap(() => this.releasing = false));
        }

        return interval(7500).pipe(takeUntil(subject));
      }),
    ).subscribe(() => {
      this.store.dispatch(new fromStore.FindSystemRecipientRows(this.systemDistributionId));
    });
  }
